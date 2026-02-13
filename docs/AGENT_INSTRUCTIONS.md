# Project Agent Guidelines

This document outlines the constraints and best practices for developing and maintaining the Lantern Aggregator project.

## Project Overview

**Project Name**: Lantern Grid Vaults
**Network**: Sui Testnet
**Core Features**:
1.  **Grid Trading Agent**: Flexible conditional investment strategy.
    -   **Multi-Asset Support**: Pay with wBTC, SUI, or USDC to DCA the other two.
    -   **Slippage Control**: Users can set max slippage tolerance for swaps.
    -   **Time-Based DCA**: Configurable intervals (1h, 1d, etc.).
    -   **Grid Strategy (Phased Investing)**: Multi-stage triggers based on Price (Buy the dip) or Time.
    -   **Custom Plans**: Users define custom plans (e.g., "Invest 2000 USDC initially, then 50% of remaining if SUI drops below 0.98").

## 1. Core Principles

1.  **Code Quality**: Write clean, readable, and well-commented code.
2.  **Testing**: All new features must include corresponding tests. Code without tests will be considered incomplete.
3.  **Security**: Prioritize security, especially in the smart contract and backend logic. Follow the principle of least privilege.
4.  **Modularity**: Design components to be modular and reusable.
5.  **Version Control**: Make atomic commits that describe the feature or fix being made.

## 2. Development Workflow

1.  **Understand the Requirement**: Before writing code, ensure a clear understanding of the requirement. Ask clarifying questions if needed.
2.  **Plan the Implementation**: Break down the task into smaller steps.
3.  **Implement**:
    -   Follow existing code patterns.
    -   Write tests first (TDD) if applicable.
    -   Ensure code passes linting and formatting checks.
4.  **Review**: Review your changes for errors or potential improvements.

## 3. Technology Stack

-   **Smart Contract**: Move(Sui)
-   **Backend**: Rust (Axum)
    - **Async Runtime**: Tokio
-   **Relayer**: Sui SDK
-   **Frontend**: React 19 + Tailwind + HeroUI
-   **Testing**: 
    - **Smart Contract**: Sui test
    - **Backend**: cargo test

## 4. Specific Constraints
### General
-   **Communication**: If you encounter ambiguity, document the assumption made and proceed. Do not leave code in a broken state.
-   **Dependencies**: Avoid adding unnecessary dependencies. If a new dependency is required, ensure it is widely used and maintained.
-   **Secrets**: Never commit secrets, API keys, or private information to the repository. Use environment variables.

### Smart Contract (Move)
-   **Safety**: Double-check all arithmetic operations for overflow/underflow (though Move handles some natively).
-   **Access Control**: Ensure all entry points have appropriate access control checks.
-   **Gas Optimization**: Be mindful of gas costs, though readability takes precedence over extreme micro-optimization.
-   **Type Safety**: Ensure `DCAPlan` strictly enforces the `StrategyStep` logic (Price/Time triggers).

### Backend
-   **API Design**: Follow RESTful principles or GraphQL best practices.
-   **Error Handling**: Implement robust error handling. Log errors appropriately without exposing sensitive information to the client.

### Frontend
-   **UI/UX**: Maintain a consistent design language.
-   **State Management**: Manage state efficiently to avoid unnecessary re-renders.

## 5. File Structure

```text
lantern-aggregator/
├── frontend/              # Frontend code (React + Vite + TS)
│   ├── src/
│   │   ├── components/    # Strategy Form, Plan List
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── lantern-aggregator-contract/ # Move smart contract (Sui)
│   ├── sources/
│   │   ├── dca_agent.move      # (Legacy) Core DCA Logic
│   │   ├── dca_types.move      # StrategyConfig, DCAState, TriggerType
│   │   ├── dca_plan.move       # NEW: DCAPlan, StrategyStep, Grid Logic
│   │   └── ...
│   ├── tests/
│   └── Move.toml
├── lantern-aggregator-backend/ # Backend code (Rust + Axum)
│   ├── src/
│   │   ├── main.rs             # API Entry & Keeper spawner
│   │   ├── keeper.rs           # Keeper Bot Loop (Monitor & Trigger)
│   │   ├── sui_client.rs      # Sui SDK Wrapper (PTB Builder)
│   │   └── plan_manager.rs    # NEW: Plan parsing and validation
│   └── Cargo.toml
└── docs/
    └── AGENT_INSTRUCTIONS.md
```

## 6. Reference

-   Move Language Documentation: https://move-language.github.io/move/
-   Cetus CLMM contract lib: "Users/tatar/.move/https___github_
com_CetusProtocol_cetus-contracts_git_testnet-v0.0.2/packages/cetus_clmm"


