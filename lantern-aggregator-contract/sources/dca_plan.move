module lantern::dca_plan {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::object::{Self, ID};
    use sui::clock::{Self, Clock};
    use std::vector;

    // 引入 types 模块
    use lantern::dca_types::{Self, DCAPlan, StrategyStep};

    // 引入 Cetus CLMM 核心模块
    use cetus_clmm::pool::{Self, Pool};
    use cetus_clmm::config::GlobalConfig;

    // 移除 Cetus Integrate pool_script_v2 的导入，改用 flash_swap
    // use cetus_integrate::pool_script_v2;

    // Vault 模块已被移除，相关功能暂时注释
    // use lantern::vault::{Self, Vault};

    // --- Errors ---
    const E_ALREADY_FINISHED: u64 = 1;
    const E_NOT_TIME_YET: u64 = 2;
    const E_NOT_OWNER: u64 = 3;
    const E_INSUFFICIENT_BALANCE: u64 = 4;

    // --- Events ---
    public struct PlanCreated has copy, drop {
        plan_id: ID,
        owner: address,
        input_asset: vector<u8>,
        timestamp: u64,
    }

    public struct StepExecuted has copy, drop {
        plan_id: ID,
        step_index: u64,
        amount_in: u64,
        amount_out: u64,
        timestamp: u64,
    }

    public struct PlanClosed has copy, drop {
        plan_id: ID,
        owner: address,
        returned_principal: u64,
        returned_output: u64,
    }

    // --- Entry Functions ---

    /// Create a new DCA Plan (T → U)
    /// @param coin - The initial capital (Coin<T>)
    /// @param steps - The strategy steps
    /// @param vault_id_opt - Optional ID of the Vault to auto-compound into
    /// @param clock - Clock for timestamp
    /// @param ctx - Transaction context
    public fun create_plan<T, U>(
        coin: Coin<T>,
        steps: vector<StrategyStep>,
        vault_id_opt: vector<ID>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // 转换 vault_id_opt 到 Option<ID>
        let vault_id = if (!vector::is_empty(&vault_id_opt)) {
            std::option::some(*vector::borrow(&vault_id_opt, 0))
        } else {
            std::option::none()
        };

        let plan = dca_types::create_plan<T, U>(coin, steps, vault_id, ctx);
        let plan_id = object::id(&plan);
        let owner = tx_context::sender(ctx);

        event::emit(PlanCreated {
            plan_id,
            owner,
            input_asset: std::type_name::with_defining_ids<T>().into_string().into_bytes(),
            timestamp: clock::timestamp_ms(clock),
        });

        // Share object for Keeper automation
        transfer::public_share_object(plan);
    }

    // Vault 功能暂时移除（等待重新实现）
    /*
    /// Deposit accumulated output to the Vault
    /// @param plan - The DCA Plan
    /// @param vault - The Vault to deposit into (must match plan.vault_id)
    /// @param ctx - Transaction context
    public entry fun deposit_to_vault<T, U>(
        plan: &mut DCAPlan<T, U>,
        vault: &mut Vault<U>,
        ctx: &mut TxContext
    ) {
        // 1. 验证 Vault ID 匹配
        let plan_vault_id_opt = dca_types::vault_id(plan);
        assert!(option::is_some(plan_vault_id_opt), E_NO_VAULT_ASSOCIATED);
        let plan_vault_id = *option::borrow(plan_vault_id_opt);
        assert!(object::id(vault) == plan_vault_id, E_WRONG_VAULT);

        // 2. 验证调用者是 Plan Owner
        assert!(tx_context::sender(ctx) == dca_types::owner(plan), E_NOT_OWNER);

        // 3. 取出所有产出资产
        let (_, output_bal) = dca_types::withdraw_all(plan, ctx);

        // 4. 存入 Vault
        let output_coin = coin::from_balance(output_bal, ctx);
        vault::deposit(vault, output_coin, ctx);
    }
    */

    /// Execute the next step - validates and advances the DCA plan
    /// Actual swap execution is handled by Keeper Bot via Cetus SDK
    /// @param plan - The DCA Plan
    /// @param clock - Clock for timestamp
    /// @param ctx - Transaction context
    public entry fun execute_next_step<T, U>(
        plan: &mut DCAPlan<T, U>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // 1. 基础检查
        assert!(dca_types::active(plan), E_ALREADY_FINISHED);

        let current_index = dca_types::current_step_index(plan);
        let steps = dca_types::steps(plan);
        let total_steps = vector::length(steps);

        // 如果步数走完了，自动关闭
        if (current_index >= total_steps) {
            dca_types::set_active(plan, false, ctx);
            return
        };

        let current_step = vector::borrow(steps, current_index);
        let current_time = clock::timestamp_ms(clock);
        let last_time = dca_types::last_execution_time(plan);

        // 2. 触发器检查 (Time Check)
        if (dca_types::step_trigger_type(current_step) == 0) {
            let interval = dca_types::step_trigger_val(current_step);
            // 第一次执行不检查时间间隔
            if (last_time > 0) {
                assert!(current_time >= last_time + interval, E_NOT_TIME_YET);
            };
        };

        // 3. 更新状态
        dca_types::advance_step(plan, current_time, ctx);

        // 4. Emit Event - 通知 Keeper 需要执行 swap
        event::emit(StepExecuted {
            plan_id: object::id(plan),
            step_index: current_index,
            amount_in: 0, // Keeper 会记录实际金额
            amount_out: 0,
            timestamp: current_time,
        });
    }

    /// Close plan and withdraw ALL assets
    public entry fun close_plan<T, U>(
        plan: &mut DCAPlan<T, U>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == dca_types::owner(plan), E_NOT_OWNER);

        // 1. 取出所有余额
        let (principal_bal, output_bal) = dca_types::withdraw_all(plan, ctx);

        let p_val = balance::value(&principal_bal);
        let o_val = balance::value(&output_bal);

        // 2. 标记关闭
        dca_types::set_active(plan, false, ctx);

        // 3. 转账回用户
        if (p_val > 0) {
            transfer::public_transfer(coin::from_balance(principal_bal, ctx), sender);
        } else {
            balance::destroy_zero(principal_bal);
        };

        if (o_val > 0) {
            transfer::public_transfer(coin::from_balance(output_bal, ctx), sender);
        } else {
            balance::destroy_zero(output_bal);
        };

        event::emit(PlanClosed {
            plan_id: object::id(plan),
            owner: sender,
            returned_principal: p_val,
            returned_output: o_val,
        });
    }
}
