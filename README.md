# 🌍 Personal Carbon Footprint Tracker & Offset Platform

Welcome to a revolutionary Web3 platform built on the Stacks blockchain that empowers individuals to track, manage, and offset their personal carbon footprints! In a world grappling with climate change, this project addresses the real-world problem of individual carbon emissions by providing transparent, verifiable tools to calculate footprints and offset them through tokenized investments in renewable energy projects. Users can earn rewards for sustainable behaviors while contributing to global green initiatives—all secured by blockchain technology.

## ✨ Features

📊 Calculate and track personal carbon footprints based on daily activities  
🔄 Offset emissions by purchasing tokenized shares in renewable energy investments  
💰 Tokenized carbon credits (CCT) for verifiable offsets  
🏆 Rewards system for low-emission lifestyles  
📈 Marketplace for trading carbon credits and investment tokens  
🔒 Secure user profiles with privacy-focused data storage  
🌱 Integration with real-world oracles for accurate emission data and renewable project verification  
📉 Analytics dashboard for emission trends and offset impact  
🚫 Anti-fraud mechanisms to prevent double-counting of offsets  

## 🛠 How It Works

This platform leverages 8 smart contracts written in Clarity to create a decentralized ecosystem for carbon management. It solves the problem of opaque carbon offsetting by making every step immutable and auditable on the blockchain, encouraging personal accountability and collective environmental action.

**For Users (Individuals Tracking Footprints)**  
- Register your profile using the UserRegistry contract.  
- Input daily activities (e.g., travel, energy use) via the CarbonCalculator contract to compute your footprint.  
- View your emission history and trends through the Analytics contract.  
- To offset, mint Carbon Credit Tokens (CCT) by investing in renewables via the OffsetManager contract.  

**For Offsetters (Investing in Renewables)**  
- Browse tokenized renewable projects (e.g., solar farms) in the InvestmentPool contract.  
- Purchase investment tokens (RET - Renewable Energy Tokens) using STX or other assets.  
- Use the Marketplace contract to trade CCT or RET with others.  
- Verify your offsets anytime with the Verification contract—prove your net-zero status!  

**For Project Owners (Renewable Developers)**  
- Submit renewable projects for tokenization via the ProjectRegistry contract.  
- Receive investments pooled from users and distribute yields back as rewards.  
- Use oracles in the DataOracle contract to report real-world impact (e.g., CO2 saved).  

Boom! Your personal actions now contribute to verifiable global sustainability, with blockchain ensuring no greenwashing.

## 📂 Smart Contracts Overview

All contracts are implemented in Clarity for security and efficiency on the Stacks blockchain. Here's a high-level breakdown of the 8 contracts involved:

1. **UserRegistry.clar**: Handles user registration, profile management, and privacy controls. Stores hashed user data for secure identity.  
2. **CarbonCalculator.clar**: Computes carbon footprints based on user inputs and predefined emission factors (e.g., kg CO2 per mile driven).  
3. **OffsetManager.clar**: Manages the offsetting process, linking footprints to investments and minting CCT tokens.  
4. **InvestmentPool.clar**: Pools user funds into tokenized renewable projects, handling deposits, withdrawals, and yield distribution.  
5. **ProjectRegistry.clar**: Registers and verifies renewable energy projects, ensuring they meet sustainability criteria before tokenization.  
6. **Marketplace.clar**: A decentralized exchange for trading CCT and RET tokens between users.  
7. **Verification.clar**: Provides functions to verify ownership of offsets, check emission histories, and prevent duplicate claims.  
8. **DataOracle.clar**: Integrates external data feeds (e.g., for real-time emission rates or project performance) to keep calculations accurate and up-to-date.  

These contracts interact seamlessly: For example, the CarbonCalculator feeds data to OffsetManager, which then interacts with InvestmentPool to tokenize investments.

## 🚀 Getting Started

1. Set up a Stacks wallet (e.g., Hiro Wallet).  
2. Deploy the contracts using the Clarity dev tools.  
3. Interact via a frontend dApp (built with React + Stacks.js) to calculate footprints and offset emissions.  
4. Test on the Stacks testnet before going live—start offsetting your carbon today!

This project not only gamifies sustainability but also creates economic incentives for green living, making it easier for anyone to contribute to a net-zero future. Let's build a greener world, one block at a time! 🌿