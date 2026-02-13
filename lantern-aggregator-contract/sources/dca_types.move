module lantern::dca_types {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::object;
    use sui::tx_context;

    // ================= Error Codes =================
    const EInsufficientBalance: u64 = 0;
    const ENotOwner: u64 = 1;

    // ================= Enums & Structs =================

    /// Trigger Type Enum
    /// 0 = Time (Interval based)
    /// 1 = Price Prediction (Oracle/DEX price)
    public struct TriggerType has store, drop, copy {
        tag: u8, 
    }

    /// Helper to create triggers clearly
    public fun type_time(): TriggerType { TriggerType { tag: 0 } }
    public fun type_price_below(): TriggerType { TriggerType { tag: 1 } }
    public fun type_price_above(): TriggerType { TriggerType { tag: 2 } }

    /// A single step in the DCA strategy
    public struct StrategyStep has store, drop, copy {
        trigger: TriggerType,
        
        /// If Time: interval in ms (e.g. 86400000 for 1 day)
        /// If Price: target price scaled (e.g. 0.9 * 10^9)
        trigger_val: u64, 
        
        /// Exact amount to sell in this step (e.g. 10 SUI)
        /// Much safer and simpler than percentage
        input_amount: u64, 

        /// Slippage tolerance in bps (e.g. 100 = 1%)
        slippage_tolerance: u64, 
    }

    /// The main strategy configuration object
    public struct DCAPlan<phantom T, phantom U> has key, store {
        id: UID,
        owner: address,

        // Strategy Execution Data
        steps: vector<StrategyStep>,
        current_step_index: u64,

        // Assets
        principal: Balance<T>,       // Asset In (e.g. USDC)
        accumulated_output: Balance<U>, // Asset Out (e.g. SUI)

        // Vault Integration (Optional)
        vault_id: Option<ID>,

        // State Tracking
        last_execution_timestamp: u64, // Last time we executed
        active: bool, // Circuit breaker to pause plan
    }

    // ================= Constructors =================

    /// Create a new DCA Plan
    /// Optionally attach a Vault ID for auto-compounding
    public fun create_plan<T, U>(
        coin: Coin<T>,
        steps: vector<StrategyStep>,
        vault_id: Option<ID>,
        ctx: &mut TxContext
    ): DCAPlan<T, U> {
        DCAPlan {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            steps,
            current_step_index: 0,
            principal: coin::into_balance(coin),
            accumulated_output: balance::zero<U>(),
            vault_id,
            last_execution_timestamp: 0, // 0 means never executed
            active: true,
        }
    }

    // ================= Public Getters (Read-Only) =================

    public fun owner<T, U>(plan: &DCAPlan<T, U>): address { plan.owner }
    public fun active<T, U>(plan: &DCAPlan<T, U>): bool { plan.active }
    public fun current_step_index<T, U>(plan: &DCAPlan<T, U>): u64 { plan.current_step_index }
    public fun steps<T, U>(plan: &DCAPlan<T, U>): &vector<StrategyStep> { &plan.steps }
    
    public fun get_step<T, U>(plan: &DCAPlan<T, U>, index: u64): &StrategyStep {
        vector::borrow(&plan.steps, index)
    }

    public fun total_steps<T, U>(plan: &DCAPlan<T, U>): u64 {
        vector::length(&plan.steps)
    }

    public fun last_execution_time<T, U>(plan: &DCAPlan<T, U>): u64 {
        plan.last_execution_timestamp
    }

    // Step Getters
    public fun step_input_amount(step: &StrategyStep): u64 { step.input_amount }
    public fun step_trigger_val(step: &StrategyStep): u64 { step.trigger_val }
    public fun step_trigger_type(step: &StrategyStep): u8 { step.trigger.tag }
    public fun step_trigger(step: &StrategyStep): &TriggerType { &step.trigger }
    public fun step_slippage_tolerance(step: &StrategyStep): u64 { step.slippage_tolerance }
    public fun trigger_tag(trigger: &TriggerType): u8 { trigger.tag }

    /// Helper to get the ID as an address (for events)
    public fun id_address<T, U>(plan: &DCAPlan<T, U>): address {
        object::uid_to_address(&plan.id)
    }

    /// Get the Vault ID if it exists
    public fun vault_id<T, U>(plan: &DCAPlan<T, U>): &Option<ID> {
        &plan.vault_id
    }

    // ================= Protected Setters (For Keeper) =================
    // 使用 public 并在函数内验证 sender 来防止恶意调用

    /// Keeper address (set during deployment)
    const KEEPER_ADDRESS: address = @0x05dd4b6d3d3b1e4c6e7d8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9;

    /// Advance the step index. Only the Keeper can call this.
    public fun advance_step<T, U>(plan: &mut DCAPlan<T, U>, now: u64, ctx: &TxContext) {
        assert!(tx_context::sender(ctx) == KEEPER_ADDRESS, ENotOwner);

        plan.current_step_index = plan.current_step_index + 1;
        plan.last_execution_timestamp = now;

        // Auto-close if finished
        if (plan.current_step_index >= vector::length(&plan.steps)) {
            plan.active = false;
        }
    }

    /// User manually closes/withdraws
    /// @param ctx 用于验证调用者是否为 Plan Owner
    public fun set_active<T, U>(plan: &mut DCAPlan<T, U>, status: bool, ctx: &TxContext) {
        assert!(plan.owner == tx_context::sender(ctx), ENotOwner);
        plan.active = status;
    }

    /// Withdraw all funds (principal + accumulated output)
    /// @param ctx 用于验证调用者是否为 Plan Owner
    public fun withdraw_all<T, U>(plan: &mut DCAPlan<T, U>, ctx: &TxContext): (Balance<T>, Balance<U>) {
        assert!(plan.owner == tx_context::sender(ctx), ENotOwner);

        let p_val = balance::value(&plan.principal);
        let o_val = balance::value(&plan.accumulated_output);

        (
            balance::split(&mut plan.principal, p_val),
            balance::split(&mut plan.accumulated_output, o_val)
        )
    }
}