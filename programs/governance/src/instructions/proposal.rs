use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::error::GovernanceError;
use crate::instructions::common::*;
use crate::state::*;

/// Create proposal
#[derive(Accounts)]
#[instruction(title: String, description: String)]
pub struct CreateProposal<'info> {
    #[account(
        init,
        payer = proposer,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [PROPOSAL_SEED, (governance_config.proposal_counter + 1).to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(
        mut,
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Proposal proposer (any user can create proposals)
    #[account(mut)]
    pub proposer: Signer<'info>,

    /// Proposer's USDC token account (for deposit)
    #[account(mut)]
    pub proposer_token_account: Account<'info, TokenAccount>,

    /// Governance system token vault (for storing deposits)
    #[account(
        mut,
        seeds = [GOVERNANCE_TOKEN_VAULT_SEED],
        bump
    )]
    pub governance_token_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

/// Create proposal handler function
pub fn create_proposal(
    ctx: Context<CreateProposal>,
    title: String,
    description: String,
    proposal_type: ProposalType,
    execution_data: Option<ExecutionData>,
    custom_deposit_raw: Option<u64>, // User-friendly custom deposit amount (e.g., 150 means 150 USDC)
) -> Result<u64> {
    let governance_config = &mut ctx.accounts.governance_config;
    let proposal = &mut ctx.accounts.proposal;
    let clock = Clock::get()?;

    // Validate title and description length using common function
    validate_proposal_content(&title, &description)?;

    // Handle custom deposit (program-side precision handling)
    let actual_deposit = if let Some(custom_raw) = custom_deposit_raw {
        // Use fixed USDC precision (9 digits), consistent with initialization logic
        // In actual deployment, should dynamically get precision from USDC mint account
        let usdc_decimals = 9u32; // Devnet USDC precision

        // Program-side precision conversion
        let custom_deposit = custom_raw
            .checked_mul(10_u64.pow(usdc_decimals))
            .ok_or(GovernanceError::MathOverflow)?;

        // Verify custom deposit cannot be lower than minimum value
        require!(
            custom_deposit >= governance_config.proposal_deposit,
            GovernanceError::InsufficientProposalDeposit
        );

        msg!(
            "Using custom deposit: {} USDC ({} tokens)",
            custom_raw,
            custom_deposit
        );

        custom_deposit
    } else {
        // Use default deposit
        governance_config.proposal_deposit
    };

    // Get proposal ID
    let proposal_id = governance_config.next_proposal_id();

    // Initialize proposal
    proposal.id = proposal_id;
    proposal.proposer = ctx.accounts.proposer.key();
    proposal.proposal_type = proposal_type;
    proposal.title = title;
    proposal.description = description;
    proposal.deposit_amount = actual_deposit;
    proposal.created_at = clock.unix_timestamp;
    proposal.voting_start = clock.unix_timestamp;
    proposal.voting_end = clock.unix_timestamp + governance_config.voting_period as i64;
    proposal.status = ProposalStatus::Pending;
    proposal.yes_votes = 0;
    proposal.no_votes = 0;
    proposal.abstain_votes = 0;
    proposal.veto_votes = 0;
    proposal.total_votes = 0;
    proposal.execution_data = execution_data;
    proposal.execution_result = None;
    proposal.bump = ctx.bumps.proposal;

    // Transfer deposit to governance system vault
    if actual_deposit > 0 {
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.proposer_token_account.to_account_info(),
                to: ctx.accounts.governance_token_vault.to_account_info(),
                authority: ctx.accounts.proposer.to_account_info(),
            },
        );

        token::transfer(transfer_ctx, actual_deposit)?;

        msg!(
            "Transferred deposit of {} tokens from proposer to governance vault",
            actual_deposit
        );
    }

    msg!("Proposal created with ID: {}", proposal_id);
    Ok(proposal_id)
}

/// Cast vote
#[derive(Accounts)]
#[instruction(proposal_id: u64)]
pub struct CastVote<'info> {
    #[account(
        mut,
        seeds = [PROPOSAL_SEED, proposal_id.to_le_bytes().as_ref()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(
        init,
        payer = voter,
        space = 8 + Vote::INIT_SPACE,
        seeds = [VOTE_SEED, proposal_id.to_le_bytes().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote: Account<'info, Vote>,

    #[account(
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Voter (must be committee member)
    #[account(mut)]
    pub voter: Signer<'info>,

    /// Voter's token account
    #[account(
        associated_token::mint = governance_config.committee_token_mint,
        associated_token::authority = voter
    )]
    pub voter_token_account: Account<'info, TokenAccount>,

    /// Committee token mint
    pub committee_token_mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
}

/// Cast vote handler function
pub fn cast_vote(ctx: Context<CastVote>, proposal_id: u64, vote_type: VoteType) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;
    let vote = &mut ctx.accounts.vote;
    let governance_config = &ctx.accounts.governance_config;
    let clock = Clock::get()?;

    // Verify voter is committee member
    require!(
        governance_config.is_committee_member(&ctx.accounts.voter.key()),
        GovernanceError::NotCommitteeMember
    );

    // Verify proposal status and voting deadline
    require!(
        proposal.status == ProposalStatus::Pending,
        GovernanceError::ProposalNotActive
    );
    require!(
        clock.unix_timestamp <= proposal.voting_end,
        GovernanceError::VotingPeriodEnded
    );

    // Get token balance snapshot (voting power will be calculated at finalization)
    let token_balance = ctx.accounts.voter_token_account.amount;
    let token_decimals = ctx.accounts.committee_token_mint.decimals;

    // Verify voter has minimum token balance
    require!(
        token_balance >= 10_u64.pow(token_decimals as u32),
        GovernanceError::InsufficientVotingPower
    );

    // Create vote record (no voting power stored, will be calculated at finalization)
    let vote_record = Vote::new(
        proposal_id,
        ctx.accounts.voter.key(),
        vote_type.clone(),
        token_balance,
        ctx.bumps.vote,
    );
    **vote = vote_record;

    msg!(
        "Vote cast: {:?} with token balance {}",
        vote_type,
        token_balance
    );
    Ok(())
}

/// Finalize proposal
#[derive(Accounts)]
#[instruction(proposal_id: u64)]
pub struct FinalizeProposal<'info> {
    #[account(
        mut,
        seeds = [PROPOSAL_SEED, proposal_id.to_le_bytes().as_ref()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Committee token mint (for calculating voting power)
    pub committee_token_mint: Account<'info, Mint>,

    /// Proposer's token account (for deposit refund)
    #[account(
        mut,
        constraint = proposer_token_account.owner == proposal.proposer @ GovernanceError::Unauthorized
    )]
    pub proposer_token_account: Account<'info, TokenAccount>,

    /// Governance system token account (for deposit handling)
    #[account(
        mut,
        seeds = [GOVERNANCE_TOKEN_VAULT_SEED],
        bump
    )]
    pub governance_token_vault: Account<'info, TokenAccount>,

    /// Governance system authority (for signing transfers)
    /// CHECK: This is the governance system's PDA authority
    #[account(
        seeds = [GOVERNANCE_AUTHORITY_SEED],
        bump
    )]
    pub governance_authority: UncheckedAccount<'info>,

    /// Token program (for deposit transfers)
    pub token_program: Program<'info, Token>,
}

/// Finalize proposal handler function
/// Automatically handle deposits:
/// - Passed/Rejected: Return 90% deposit to proposer, 10% to committee
/// - Vetoed: All deposit confiscated to committee
pub fn finalize_proposal<'info>(
    ctx: Context<'_, '_, 'info, 'info, FinalizeProposal<'info>>,
    proposal_id: u64,
) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;
    let governance_config = &ctx.accounts.governance_config;
    let committee_token_mint = &ctx.accounts.committee_token_mint;

    // Calculate voting results by iterating through all vote accounts in remaining_accounts
    let (total_voting_power, vote_results) = calculate_voting_results_from_votes(
        governance_config,
        committee_token_mint,
        &ctx.remaining_accounts,
        proposal_id,
    )?;

    msg!("Calculated total voting power: {}", total_voting_power);
    msg!(
        "Vote results: yes={}, no={}, abstain={}, veto={}",
        vote_results.0,
        vote_results.1,
        vote_results.2,
        vote_results.3
    );

    // Update proposal vote statistics with calculated results
    proposal.yes_votes = vote_results.0;
    proposal.no_votes = vote_results.1;
    proposal.abstain_votes = vote_results.2;
    proposal.veto_votes = vote_results.3;
    proposal.total_votes = vote_results.0 + vote_results.1 + vote_results.2 + vote_results.3;

    // Finalize proposal
    proposal.finalize(governance_config, total_voting_power)?;

    msg!(
        "Proposal {} finalized with status: {:?}",
        proposal_id,
        proposal.status
    );

    // Automatically handle deposit
    handle_deposit_automatically(
        proposal,
        proposal_id,
        &ctx.accounts.proposer_token_account,
        &ctx.accounts.governance_token_vault,
        &ctx.accounts.governance_authority,
        &ctx.accounts.token_program,
        &ctx.bumps,
    )?;

    Ok(())
}

/// Helper function to automatically handle deposits
fn handle_deposit_automatically<'info>(
    proposal: &Proposal,
    proposal_id: u64,
    proposer_token_account: &Account<'info, TokenAccount>,
    governance_token_vault: &Account<'info, TokenAccount>,
    governance_authority: &UncheckedAccount<'info>,
    token_program: &Program<'info, Token>,
    bumps: &FinalizeProposalBumps,
) -> Result<()> {
    // Generate PDA signing seeds
    let authority_bump = bumps.governance_authority;
    let authority_seeds = &[GOVERNANCE_AUTHORITY_SEED, &[authority_bump]];
    let signer_seeds = &[&authority_seeds[..]];

    let deposit_amount = proposal.deposit_amount;

    match proposal.status {
        ProposalStatus::Passed | ProposalStatus::Rejected | ProposalStatus::Executed => {
            // Proposal passed or rejected: return 90% to proposer, 10% remains in program vault
            let refund_amount = deposit_amount * 90 / 100; // 90%
            let program_fee = deposit_amount - refund_amount; // 10%

            // Refund to proposer
            if refund_amount > 0 {
                let refund_ctx = CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    Transfer {
                        from: governance_token_vault.to_account_info(),
                        to: proposer_token_account.to_account_info(),
                        authority: governance_authority.to_account_info(),
                    },
                    signer_seeds,
                );

                token::transfer(refund_ctx, refund_amount)?;
            }

            // 10% fee remains in program vault, no transfer needed
            msg!(
                "Proposal {} deposit auto-processed: {} refunded to proposer, {} remains in program vault",
                proposal_id,
                refund_amount,
                program_fee
            );
        }
        ProposalStatus::Vetoed => {
            // Proposal vetoed: deposit already in committee program token account, no transfer needed
            msg!(
                "Proposal {} vetoed: {} deposit remains in committee program token account",
                proposal_id,
                deposit_amount
            );
        }
        _ => {
            // Other statuses do not process deposits
            msg!(
                "Proposal {} status {:?} - no deposit processing needed",
                proposal_id,
                proposal.status
            );
        }
    }

    Ok(())
}

/// Execute proposal (simplified version)
#[derive(Accounts)]
#[instruction(proposal_id: u64)]
pub struct ExecuteProposal<'info> {
    #[account(
        mut,
        seeds = [PROPOSAL_SEED, proposal_id.to_le_bytes().as_ref()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,
}

/// Execute proposal handler function (simplified version, only updates status)
pub fn execute_proposal(ctx: Context<ExecuteProposal>, proposal_id: u64) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;
    let clock = Clock::get()?;

    // Verify proposal can be executed
    require!(
        proposal.can_execute(),
        GovernanceError::ProposalNotExecutable
    );

    // Simplified execution logic: only update status and record time
    let execution_result = format!(
        "Proposal {} executed at timestamp {}. Type: {:?}",
        proposal_id, clock.unix_timestamp, proposal.proposal_type
    );

    proposal.mark_executed(execution_result)?;

    msg!("Proposal {} executed successfully", proposal_id);
    Ok(())
}

/// Calculate voting results from vote accounts and total voting power
/// Returns (total_voting_power, (yes_votes, no_votes, abstain_votes, veto_votes))
pub fn calculate_voting_results_from_votes<'info>(
    governance_config: &GovernanceConfig,
    committee_token_mint: &Account<'info, Mint>,
    remaining_accounts: &'info [AccountInfo<'info>],
    proposal_id: u64,
) -> Result<(u64, (u64, u64, u64, u64))> {
    use crate::state::vote::{Vote, VotingPowerCalculator};
    use anchor_spl::token::TokenAccount;

    let token_decimals = committee_token_mint.decimals;
    let mut total_voting_power = 0u64;
    let mut yes_votes = 0u64;
    let mut no_votes = 0u64;
    let mut abstain_votes = 0u64;
    let mut veto_votes = 0u64;

    // First pass: calculate total voting power from all committee members' token accounts

    for (i, member) in governance_config.committee_members.iter().enumerate() {
        msg!("--- Processing committee member slot {} ---", i);

        if let Some(member_pubkey) = member {
            msg!("Committee member {}: {}", i, member_pubkey);

            if let Some(account_info) = remaining_accounts.get(i) {
                msg!("Found account for member {}: {}", i, account_info.key);
                msg!("Account owner: {}", account_info.owner);
                msg!("Account size: {}", account_info.data.borrow().len());
                msg!("Expected owner (Token program): {}", anchor_spl::token::ID);

                // Verify account is owned by Token program
                if account_info.owner != &anchor_spl::token::ID {
                    msg!(
                        "❌ SKIP: Account {} not owned by Token program",
                        account_info.key
                    );
                    msg!("   Actual owner: {}", account_info.owner);
                    msg!("   Expected owner: {}", anchor_spl::token::ID);
                    continue;
                }
                msg!("✅ Account owned by Token program");

                // Verify account data size for TokenAccount
                let expected_token_account_size = 165; // Standard TokenAccount size
                let actual_size = account_info.data.borrow().len();
                if actual_size != expected_token_account_size {
                    continue;
                }

                // Try to deserialize as TokenAccount
                match TokenAccount::try_deserialize(&mut account_info.data.borrow().as_ref()) {
                    Ok(token_account) => {
                        // Check owner and mint match
                        let owner_match = token_account.owner == *member_pubkey;
                        let mint_match = token_account.mint == committee_token_mint.key();

                        if owner_match && mint_match {
                            let voting_power = VotingPowerCalculator::calculate_voting_power(
                                token_account.amount,
                                token_decimals,
                            );
                            total_voting_power += voting_power;
                        }
                    }
                    Err(_) => {
                        return Err(GovernanceError::InvalidAccountData.into());
                    }
                }
            }
        }
    }

    // Second pass: calculate vote results from vote accounts
    // We pass member token accounts first, then vote accounts
    let vote_account_start_index = governance_config.committee_member_count as usize;

    for (i, account_info) in remaining_accounts
        .iter()
        .skip(vote_account_start_index)
        .enumerate()
    {
        // Only process accounts owned by our program
        if account_info.owner != &crate::ID {
            continue;
        }

        // Check account data size - Vote accounts should be exactly the right size
        let expected_vote_size = 76; // 8 + 8 + 32 + 1 + 8 + 8 + 1 + 9 + 1
        let actual_size = account_info.data.borrow().len();
        if actual_size != expected_vote_size {
            continue;
        }

        // Check discriminator to ensure it's a Vote account
        let data = account_info.data.borrow();
        if data.len() < 8 {
            msg!(
                "Skipping account {} (index {}): data too short",
                account_info.key,
                vote_account_start_index + i
            );
            continue;
        }

        // Get Vote discriminator (first 8 bytes)
        // For now, we'll skip discriminator check and rely on try_deserialize
        // The discriminator is generated by Anchor and we can't easily access it here

        // Now try to deserialize as Vote account
        match Vote::try_deserialize(&mut data.as_ref()) {
            Ok(vote) => {
                msg!(
                    "Successfully deserialized vote account {} (index {})",
                    account_info.key,
                    vote_account_start_index + i
                );

                if vote.proposal_id == proposal_id && vote.is_valid() {
                    let voting_power = vote.calculate_voting_power(token_decimals);

                    match vote.vote_type {
                        crate::state::proposal::VoteType::Yes => yes_votes += voting_power,
                        crate::state::proposal::VoteType::No => no_votes += voting_power,
                        crate::state::proposal::VoteType::Abstain => abstain_votes += voting_power,
                        crate::state::proposal::VoteType::NoWithVeto => veto_votes += voting_power,
                    }
                }
            }
            Err(_) => {
                continue;
            }
        }
    }

    Ok((
        total_voting_power,
        (yes_votes, no_votes, abstain_votes, veto_votes),
    ))
}

/// Close vote account
#[derive(Accounts)]
pub struct CloseVote<'info> {
    #[account(
        mut,
        close = authority
    )]
    pub vote: Account<'info, Vote>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// Governance config to verify authority
    #[account(
        constraint = governance_config.authority == authority.key()
    )]
    pub governance_config: Account<'info, GovernanceConfig>,
}

/// Close vote account handler function
/// Only governance authority can close any vote account
pub fn close_vote(ctx: Context<CloseVote>) -> Result<()> {
    let vote = &ctx.accounts.vote;
    msg!(
        "Vote account closed by authority: {} (voter: {}, proposal: {})",
        ctx.accounts.vote.key(),
        vote.voter,
        vote.proposal_id
    );
    Ok(())
}
