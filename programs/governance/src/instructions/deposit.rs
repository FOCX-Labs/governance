use anchor_lang::prelude::*;
use anchor_spl::token::{self, InitializeAccount, Mint, Token, TokenAccount};

use crate::instructions::common::*;

/// Initialize governance system token vault
pub fn initialize_token_vault(ctx: Context<InitializeTokenVault>) -> Result<()> {
    msg!("Initializing governance token vault");

    // Use CPI to create token account
    let create_account_ix = anchor_lang::solana_program::system_instruction::create_account(
        &ctx.accounts.payer.key(),
        &ctx.accounts.token_vault.key(),
        ctx.accounts.rent.minimum_balance(TokenAccount::LEN),
        TokenAccount::LEN as u64,
        &ctx.accounts.token_program.key(),
    );

    // Execute create account instruction
    anchor_lang::solana_program::program::invoke_signed(
        &create_account_ix,
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.token_vault.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[&[GOVERNANCE_TOKEN_VAULT_SEED, &[ctx.bumps.token_vault]]],
    )?;

    // Initialize token account
    let cpi_accounts = InitializeAccount {
        account: ctx.accounts.token_vault.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.governance_authority.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    token::initialize_account(cpi_ctx)?;

    msg!("Governance token vault initialized successfully");
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeTokenVault<'info> {
    /// Token vault account (PDA)
    /// CHECK: This account will be created through CPI
    #[account(
        mut,
        seeds = [GOVERNANCE_TOKEN_VAULT_SEED],
        bump
    )]
    pub token_vault: UncheckedAccount<'info>,

    /// Token mint
    pub mint: Account<'info, Mint>,

    /// Governance authority (PDA)
    /// CHECK: This is a PDA used as token account authority
    #[account(
        seeds = [GOVERNANCE_AUTHORITY_SEED],
        bump
    )]
    pub governance_authority: UncheckedAccount<'info>,

    /// Payer account
    #[account(mut)]
    pub payer: Signer<'info>,

    /// System program
    pub system_program: Program<'info, System>,

    /// Token program
    pub token_program: Program<'info, Token>,

    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
}
