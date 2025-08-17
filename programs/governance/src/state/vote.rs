use anchor_lang::prelude::*;

/// Vote record account
#[account]
#[derive(InitSpace)]
pub struct Vote {
    /// Proposal ID
    pub proposal_id: u64,
    /// Voter address
    pub voter: Pubkey,
    /// Vote type
    pub vote_type: VoteType,
    /// Vote time
    pub timestamp: i64,
    /// Voter token balance snapshot
    pub token_balance_snapshot: u64,
    /// Whether revoked
    pub is_revoked: bool,
    /// Revocation time
    pub revoked_at: Option<i64>,
    /// PDA bump
    pub bump: u8,
}

impl Vote {
    /// Create new vote record
    pub fn new(
        proposal_id: u64,
        voter: Pubkey,
        vote_type: VoteType,
        token_balance_snapshot: u64,
        bump: u8,
    ) -> Self {
        Self {
            proposal_id,
            voter,
            vote_type,
            timestamp: Clock::get().unwrap().unix_timestamp,
            token_balance_snapshot,
            is_revoked: false,
            revoked_at: None,
            bump,
        }
    }

    /// Revoke vote
    pub fn revoke(&mut self) -> Result<()> {
        require!(
            !self.is_revoked,
            crate::error::GovernanceError::VoteAlreadyRevoked
        );

        self.is_revoked = true;
        self.revoked_at = Some(Clock::get()?.unix_timestamp);
        Ok(())
    }

    /// Check if vote is valid
    pub fn is_valid(&self) -> bool {
        !self.is_revoked && self.token_balance_snapshot > 0
    }

    /// Calculate effective voting power (based on token balance snapshot)
    pub fn calculate_voting_power(&self, token_decimals: u8) -> u64 {
        if self.is_valid() {
            self.token_balance_snapshot / (10_u64.pow(token_decimals as u32))
        } else {
            0
        }
    }
}

/// Vote type (re-exported to avoid duplicate definition)
pub use crate::state::proposal::VoteType;

/// Vote statistics
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
pub struct VoteStats {
    /// Total votes
    pub total_votes: u64,
    /// Yes votes
    pub yes_votes: u64,
    /// No votes
    pub no_votes: u64,
    /// Abstain votes
    pub abstain_votes: u64,
    /// Veto votes
    pub veto_votes: u64,
    /// Number of participants
    pub voter_count: u32,
}

impl VoteStats {
    /// Calculate participation rate
    pub fn calculate_participation_rate(&self, total_voting_power: u64) -> u16 {
        if total_voting_power == 0 {
            return 0;
        }
        ((self.total_votes * 10000) / total_voting_power) as u16
    }

    /// Calculate approval rate
    pub fn calculate_approval_rate(&self) -> u16 {
        if self.total_votes == 0 {
            return 0;
        }
        ((self.yes_votes * 10000) / self.total_votes) as u16
    }

    /// Calculate veto rate
    pub fn calculate_veto_rate(&self) -> u16 {
        if self.total_votes == 0 {
            return 0;
        }
        ((self.veto_votes * 10000) / self.total_votes) as u16
    }

    /// Check if participation threshold is met
    pub fn meets_participation_threshold(&self, total_voting_power: u64, threshold: u16) -> bool {
        self.calculate_participation_rate(total_voting_power) >= threshold
    }

    /// Check if proposal passes (strictly greater than threshold, equal to threshold is considered not passed)
    pub fn is_approved(&self, threshold: u16) -> bool {
        self.calculate_approval_rate() > threshold
    }

    /// Check if proposal is vetoed
    pub fn is_vetoed(&self, threshold: u16) -> bool {
        self.calculate_veto_rate() >= threshold
    }

    /// Comprehensively determine the final status of the proposal
    /// Judge according to the priority of governance rules: veto > insufficient participation > pass/reject
    pub fn determine_proposal_status(
        &self,
        total_voting_power: u64,
        participation_threshold: u16,
        approval_threshold: u16,
        veto_threshold: u16,
    ) -> crate::state::proposal::ProposalStatus {
        use crate::state::proposal::ProposalStatus;

        // 1. First check if vetoed (highest priority)
        if self.is_vetoed(veto_threshold) {
            return ProposalStatus::Vetoed;
        }

        // 2. Check if participation rate meets requirements
        if !self.meets_participation_threshold(total_voting_power, participation_threshold) {
            return ProposalStatus::Rejected;
        }

        // 3. Check if proposal passes
        if self.is_approved(approval_threshold) {
            ProposalStatus::Passed
        } else {
            ProposalStatus::Rejected
        }
    }
}

/// Voting power calculator
pub struct VotingPowerCalculator;

impl VotingPowerCalculator {
    /// Calculate voting power based on committee member token balance
    /// Only committee members can get voting power
    pub fn calculate_voting_power(token_balance: u64, token_decimals: u8) -> u64 {
        // Calculate voting power based on SPL Token balance
        // 1 complete token = 1 voting power
        token_balance / (10_u64.pow(token_decimals as u32))
    }

    /// Validate voting power
    pub fn validate_voting_power(
        claimed_power: u64,
        token_balance: u64,
        token_decimals: u8,
    ) -> bool {
        let calculated_power = Self::calculate_voting_power(token_balance, token_decimals);
        claimed_power <= calculated_power
    }

    /// Calculate minimum voting power requirement
    pub fn minimum_voting_power(token_decimals: u8) -> u64 {
        // At least 1 complete token is required to vote
        10_u64.pow(token_decimals as u32)
    }

    /// Verify committee member identity and calculate voting power
    pub fn calculate_committee_voting_power(
        member: &Pubkey,
        governance_config: &crate::state::GovernanceConfig,
        token_balance: u64,
        token_decimals: u8,
    ) -> Result<u64> {
        // Verify if is committee member
        require!(
            governance_config.is_committee_member(member),
            crate::error::GovernanceError::NotCommitteeMember
        );

        // Calculate voting power
        let voting_power = Self::calculate_voting_power(token_balance, token_decimals);

        require!(
            voting_power > 0,
            crate::error::GovernanceError::InsufficientVotingPower
        );

        Ok(voting_power)
    }
}

/// Vote delegation (future feature)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct VoteDelegation {
    /// Delegator
    pub delegator: Pubkey,
    /// Delegatee
    pub delegate: Pubkey,
    /// Delegated voting power
    pub delegated_power: u64,
    /// Delegation start time
    pub start_time: i64,
    /// Delegation end time (None means permanent delegation)
    pub end_time: Option<i64>,
    /// Whether active
    pub is_active: bool,
}

impl VoteDelegation {
    /// Check if delegation is valid
    pub fn is_valid(&self, current_time: i64) -> bool {
        self.is_active
            && current_time >= self.start_time
            && (self.end_time.is_none() || current_time <= self.end_time.unwrap())
    }

    /// Revoke delegation
    pub fn revoke(&mut self) {
        self.is_active = false;
    }
}

/// Vote-related constants
pub mod vote_constants {
    /// Minimum voting power
    pub const MIN_VOTING_POWER: u64 = 1;
    /// Vote revocation deadline (1 hour before voting ends)
    pub const VOTE_REVOCATION_DEADLINE: i64 = 3600;
    /// Maximum delegation count
    pub const MAX_DELEGATIONS_PER_USER: usize = 10;
}
