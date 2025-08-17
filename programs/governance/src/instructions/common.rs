use crate::error::GovernanceError;
use crate::state::*;
use anchor_lang::prelude::*;

// ==================== Constant definitions ====================

/// Percentage calculation base (100.00%)
pub const PERCENTAGE_BASE: u16 = 10000;

/// Governance configuration PDA seed
pub const GOVERNANCE_CONFIG_SEED: &[u8] = b"governance_config";

/// Governance authority PDA seed
pub const GOVERNANCE_AUTHORITY_SEED: &[u8] = b"governance_authority";

/// Governance token vault PDA seed
pub const GOVERNANCE_TOKEN_VAULT_SEED: &[u8] = b"governance_token_vault";

/// Rule registry PDA seed
pub const RULE_REGISTRY_SEED: &[u8] = b"rule_registry";

/// Proposal PDA seed
pub const PROPOSAL_SEED: &[u8] = b"proposal";

/// Vote PDA seed
pub const VOTE_SEED: &[u8] = b"vote";

// ==================== Macro definitions ====================

/// Macro for validating administrator permissions
#[macro_export]
macro_rules! require_admin_authority {
    ($authority:expr, $governance_config:expr) => {
        require!(
            $authority.key() == $governance_config.authority,
            GovernanceError::Unauthorized
        );
    };
}

/// Macro for validating committee members
#[macro_export]
macro_rules! require_committee_member {
    ($member:expr, $governance_config:expr) => {
        require!(
            $governance_config.is_committee_member(&$member.key()),
            GovernanceError::NotCommitteeMember
        );
    };
}

/// Macro for validating percentage thresholds
#[macro_export]
macro_rules! require_valid_threshold {
    ($threshold:expr) => {
        require!(
            $threshold <= PERCENTAGE_BASE,
            GovernanceError::InvalidThreshold
        );
    };
}

// ==================== Common functions ====================

/// Update account timestamp
pub fn update_timestamp<T>(account: &mut T) -> Result<()>
where
    T: TimestampUpdatable,
{
    let clock = Clock::get()?;
    account.set_updated_at(clock.unix_timestamp);
    Ok(())
}

/// Validate URL format
pub fn validate_url(url: &str) -> bool {
    url.starts_with("https://") || url.starts_with("ipfs://") || url.starts_with("ar://")
}

/// Validate hash format (64-bit hexadecimal)
pub fn validate_hash(hash: &str) -> bool {
    hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit())
}

/// Validate voting period (based on test mode)
pub fn validate_voting_period(voting_period: u64, test_mode: bool) -> Result<()> {
    if test_mode {
        require!(
            voting_period >= 30, // Test mode: at least 30 seconds
            GovernanceError::InvalidVotingPeriod
        );
        require!(
            voting_period <= 2592000, // Test mode: maximum 30 days
            GovernanceError::InvalidVotingPeriod
        );
    } else {
        require!(
            voting_period >= 86400, // Production mode: at least 1 day
            GovernanceError::InvalidVotingPeriod
        );
        require!(
            voting_period <= 2592000, // Production mode: maximum 30 days
            GovernanceError::InvalidVotingPeriod
        );
    }
    Ok(())
}

/// Validate proposal title and description length
pub fn validate_proposal_content(title: &str, description: &str) -> Result<()> {
    require!(
        title.len() <= 100,
        GovernanceError::InvalidProposalTitleLength
    );
    require!(
        description.len() <= 800,
        GovernanceError::InvalidProposalDescriptionLength
    );
    Ok(())
}

// ==================== Trait Definitions ====================

/// Trait for updatable timestamp
pub trait TimestampUpdatable {
    fn set_updated_at(&mut self, timestamp: i64);
}

// Implement TimestampUpdatable for GovernanceConfig
impl TimestampUpdatable for GovernanceConfig {
    fn set_updated_at(&mut self, timestamp: i64) {
        self.updated_at = timestamp;
    }
}

// Implement TimestampUpdatable for RuleRegistry
impl TimestampUpdatable for RuleRegistry {
    fn set_updated_at(&mut self, timestamp: i64) {
        self.last_updated = timestamp;
    }
}

// ==================== Common account constraint structures ====================

/// Governance configuration account constraint (read-only)
#[derive(Accounts)]
pub struct GovernanceConfigConstraint<'info> {
    #[account(
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,
}

/// Governance configuration account constraint (mutable)
#[derive(Accounts)]
pub struct MutableGovernanceConfigConstraint<'info> {
    #[account(
        mut,
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,
}

/// Administrator authority verification constraint
#[derive(Accounts)]
pub struct AdminAuthorityConstraint<'info> {
    #[account(
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    #[account(
        constraint = authority.key() == governance_config.authority @ GovernanceError::Unauthorized
    )]
    pub authority: Signer<'info>,
}

/// Mutable administrator authority verification constraint
#[derive(Accounts)]
pub struct MutableAdminAuthorityConstraint<'info> {
    #[account(
        mut,
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    #[account(
        constraint = authority.key() == governance_config.authority @ GovernanceError::Unauthorized
    )]
    pub authority: Signer<'info>,
}
