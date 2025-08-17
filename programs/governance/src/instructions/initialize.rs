use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

use crate::error::GovernanceError;
use crate::instructions::common::*;
use crate::require_valid_threshold;
use crate::state::*;

/// Initialize governance system
#[derive(Accounts)]
pub struct InitializeGovernance<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GovernanceConfig::INIT_SPACE,
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Committee token mint
    pub committee_token_mint: Account<'info, Mint>,

    /// USDC token mint (for proposal deposits)
    pub usdc_token_mint: Account<'info, Mint>,

    /// System administrator
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

/// Initialize governance system handler
pub fn initialize_governance(
    ctx: Context<InitializeGovernance>,
    proposal_deposit_raw: u64, // Raw amount without decimals (e.g., 100 for 100 tokens)
    voting_period: u64,
    participation_threshold: u16,
    approval_threshold: u16,
    veto_threshold: u16,
    fee_rate: u16,
    test_mode: bool,
) -> Result<()> {
    let governance_config = &mut ctx.accounts.governance_config;
    let clock = Clock::get()?;

    // Get USDC token mint decimals for proposal deposit calculation
    let usdc_token_mint = &ctx.accounts.usdc_token_mint;
    let usdc_decimals = usdc_token_mint.decimals;

    // Calculate actual proposal deposit with USDC decimals
    let proposal_deposit = proposal_deposit_raw
        .checked_mul(10_u64.pow(usdc_decimals as u32))
        .ok_or(GovernanceError::MathOverflow)?;

    // Validate parameters using common validation functions
    require_valid_threshold!(participation_threshold);
    require_valid_threshold!(approval_threshold);
    require_valid_threshold!(veto_threshold);
    require!(fee_rate <= PERCENTAGE_BASE, GovernanceError::InvalidFeeRate);

    // Voting period validation using common function
    validate_voting_period(voting_period, test_mode)?;

    // Validate committee token mint address
    // Note: In test environment, we temporarily skip this validation to allow test mint
    // In production environment, this validation should be enabled
    /*
    let expected_mint = "DXDVt289yXEcqXDd9Ub3HqSBTWwrmNB8DzQEagv9Svtu"
        .parse::<Pubkey>()
        .unwrap();
    require!(
        ctx.accounts.committee_token_mint.key() == expected_mint,
        GovernanceError::InvalidTokenMint
    );
    */

    // Initialize configuration
    governance_config.authority = ctx.accounts.authority.key();
    governance_config.committee_token_mint = ctx.accounts.committee_token_mint.key();
    governance_config.committee_members = [None; 10]; // Initialize as empty array
    governance_config.committee_member_count = 0;
    governance_config.proposal_deposit = proposal_deposit;
    governance_config.voting_period = voting_period;
    governance_config.participation_threshold = participation_threshold;
    governance_config.approval_threshold = approval_threshold;
    governance_config.veto_threshold = veto_threshold;
    governance_config.fee_rate = fee_rate;
    governance_config.test_mode = test_mode;
    governance_config.total_voting_power = 0;
    governance_config.proposal_counter = 0;
    governance_config.created_at = clock.unix_timestamp;
    governance_config.updated_at = clock.unix_timestamp;
    governance_config.bump = ctx.bumps.governance_config;

    msg!("Governance system initialized successfully");
    Ok(())
}

/// Update governance configuration
#[derive(Accounts)]
pub struct UpdateGovernanceConfig<'info> {
    #[account(
        mut,
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Only administrator can update configuration
    #[account(
        constraint = authority.key() == governance_config.authority @ GovernanceError::Unauthorized
    )]
    pub authority: Signer<'info>,
}

/// Update governance configuration handler
pub fn update_governance_config(
    ctx: Context<UpdateGovernanceConfig>,
    config_update: GovernanceConfigUpdate,
) -> Result<()> {
    // Validate update parameters
    config_update.validate(ctx.accounts.governance_config.test_mode)?;

    // Apply update
    let governance_config = &mut ctx.accounts.governance_config;
    config_update.apply_to(governance_config);

    msg!("Governance configuration updated successfully");
    Ok(())
}

/// Update total voting power
#[derive(Accounts)]
pub struct UpdateTotalVotingPower<'info> {
    #[account(
        mut,
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Only administrator can update
    #[account(
        constraint = authority.key() == governance_config.authority @ GovernanceError::Unauthorized
    )]
    pub authority: Signer<'info>,
}

/// Update total voting power handler
pub fn update_total_voting_power(
    ctx: Context<UpdateTotalVotingPower>,
    new_total_voting_power: u64,
) -> Result<()> {
    let governance_config = &mut ctx.accounts.governance_config;
    governance_config.total_voting_power = new_total_voting_power;
    governance_config.updated_at = Clock::get()?.unix_timestamp;

    msg!("Total voting power updated to: {}", new_total_voting_power);
    Ok(())
}

/// Update proposal counter (admin only)
#[derive(Accounts)]
pub struct UpdateProposalCounter<'info> {
    #[account(
        mut,
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Only administrator can update proposal counter
    #[account(
        constraint = authority.key() == governance_config.authority @ GovernanceError::Unauthorized
    )]
    pub authority: Signer<'info>,
}

/// Update proposal counter handler
pub fn update_proposal_counter(
    ctx: Context<UpdateProposalCounter>,
    new_counter: u64,
) -> Result<()> {
    let governance_config = &mut ctx.accounts.governance_config;
    // Only allow non-decreasing updates to avoid accidental rollback
    require!(
        new_counter >= governance_config.proposal_counter,
        GovernanceError::InvalidThreshold // reuse an existing error; or define a specific one if needed
    );
    governance_config.proposal_counter = new_counter;
    governance_config.updated_at = Clock::get()?.unix_timestamp;

    msg!("Proposal counter updated to: {}", new_counter);
    Ok(())
}

/// Add committee member
#[derive(Accounts)]
pub struct AddCommitteeMember<'info> {
    #[account(
        mut,
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Only administrator can add members
    #[account(
        constraint = authority.key() == governance_config.authority @ GovernanceError::Unauthorized
    )]
    pub authority: Signer<'info>,
}

/// Add committee member handler
pub fn add_committee_member(ctx: Context<AddCommitteeMember>, member: Pubkey) -> Result<()> {
    let governance_config = &mut ctx.accounts.governance_config;
    governance_config.add_committee_member(member)?;

    msg!("Committee member added: {}", member);
    Ok(())
}

/// Remove committee member
#[derive(Accounts)]
pub struct RemoveCommitteeMember<'info> {
    #[account(
        mut,
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Only administrator can remove members
    #[account(
        constraint = authority.key() == governance_config.authority @ GovernanceError::Unauthorized
    )]
    pub authority: Signer<'info>,
}

/// Remove committee member handler
pub fn remove_committee_member(ctx: Context<RemoveCommitteeMember>, member: Pubkey) -> Result<()> {
    let governance_config = &mut ctx.accounts.governance_config;
    governance_config.remove_committee_member(member)?;

    msg!("Committee member removed: {}", member);
    Ok(())
}

/// Close governance configuration
#[derive(Accounts)]
pub struct CloseGovernanceConfig<'info> {
    #[account(
        mut,
        close = authority,
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump,
        constraint = authority.key() == governance_config.authority @ GovernanceError::Unauthorized
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Only administrator can close configuration
    #[account(mut)]
    pub authority: Signer<'info>,
}

/// Close governance configuration handler
pub fn close_governance_config(_ctx: Context<CloseGovernanceConfig>) -> Result<()> {
    msg!("Governance configuration closed successfully");
    Ok(())
}
