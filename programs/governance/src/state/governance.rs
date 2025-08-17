use anchor_lang::prelude::*;

/// Governance system configuration account
#[account]
#[derive(InitSpace)]
pub struct GovernanceConfig {
    /// Administrator address
    pub authority: Pubkey,
    /// Committee token mint address (fixed to specified SPL Token)
    pub committee_token_mint: Pubkey,
    /// Committee member address array (maximum 10 members)
    pub committee_members: [Option<Pubkey>; 10],
    /// Committee member count
    pub committee_member_count: u8,
    /// Proposal deposit amount (100 USDC)
    pub proposal_deposit: u64,
    /// Voting period (14 days, in seconds)
    pub voting_period: u64,
    /// Participation threshold requirement (40% = 4000 basis points)
    pub participation_threshold: u16,
    /// Approval threshold requirement (50% = 5000 basis points)
    pub approval_threshold: u16,
    /// Veto threshold (30% = 3000 basis points)
    pub veto_threshold: u16,
    /// Committee fee rate (10% = 1000 basis points)
    pub fee_rate: u16,
    /// Total voting power
    pub total_voting_power: u64,
    /// Proposal counter
    pub proposal_counter: u64,
    /// Creation time
    pub created_at: i64,
    /// Last update time
    pub updated_at: i64,
    /// Test mode flag
    pub test_mode: bool,
    /// PDA bump
    pub bump: u8,
}

impl GovernanceConfig {
    /// Get next proposal ID
    pub fn next_proposal_id(&mut self) -> u64 {
        self.proposal_counter += 1;
        self.proposal_counter
    }

    /// Calculate committee fee
    pub fn calculate_committee_fee(&self, amount: u64) -> u64 {
        (amount * self.fee_rate as u64) / 10000
    }

    /// Calculate proposer refund amount
    pub fn calculate_proposer_refund(&self, deposit: u64) -> u64 {
        deposit - self.calculate_committee_fee(deposit)
    }

    /// Use VoteStats to uniformly determine proposal status
    pub fn determine_proposal_status_with_vote_stats(
        &self,
        vote_stats: &crate::state::vote::VoteStats,
        total_voting_power: u64,
    ) -> crate::state::proposal::ProposalStatus {
        vote_stats.determine_proposal_status(
            total_voting_power,
            self.participation_threshold,
            self.approval_threshold,
            self.veto_threshold,
        )
    }

    /// Add committee member
    pub fn add_committee_member(&mut self, member: Pubkey) -> Result<()> {
        require!(
            self.committee_member_count < 10,
            crate::error::GovernanceError::CommitteeFull
        );

        // Check if already exists
        for existing_member in self.committee_members.iter() {
            if let Some(existing) = existing_member {
                require!(
                    *existing != member,
                    crate::error::GovernanceError::MemberAlreadyExists
                );
            }
        }

        // Add to the first empty slot
        for slot in self.committee_members.iter_mut() {
            if slot.is_none() {
                *slot = Some(member);
                self.committee_member_count += 1;
                self.updated_at = Clock::get()?.unix_timestamp;
                return Ok(());
            }
        }

        Err(crate::error::GovernanceError::CommitteeFull.into())
    }

    /// Remove committee member
    pub fn remove_committee_member(&mut self, member: Pubkey) -> Result<()> {
        for slot in self.committee_members.iter_mut() {
            if let Some(existing) = slot {
                if *existing == member {
                    *slot = None;
                    self.committee_member_count -= 1;
                    self.updated_at = Clock::get()?.unix_timestamp;
                    return Ok(());
                }
            }
        }

        Err(crate::error::GovernanceError::MemberNotFound.into())
    }

    /// Check if is committee member
    pub fn is_committee_member(&self, member: &Pubkey) -> bool {
        self.committee_members.iter().any(|slot| {
            if let Some(existing) = slot {
                existing == member
            } else {
                false
            }
        })
    }

    /// Get all committee members
    pub fn get_committee_members(&self) -> Vec<Pubkey> {
        self.committee_members
            .iter()
            .filter_map(|slot| *slot)
            .collect()
    }
}

/// Governance configuration update parameters
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct GovernanceConfigUpdate {
    pub proposal_deposit: Option<u64>,
    pub voting_period: Option<u64>,
    pub participation_threshold: Option<u16>,
    pub approval_threshold: Option<u16>,
    pub veto_threshold: Option<u16>,
    pub fee_rate: Option<u16>,
    pub test_mode: Option<bool>,
}

impl GovernanceConfigUpdate {
    /// Validate the validity of update parameters
    pub fn validate(&self, current_test_mode: bool) -> Result<()> {
        if let Some(participation_threshold) = self.participation_threshold {
            require!(
                participation_threshold <= 10000,
                crate::error::GovernanceError::InvalidThreshold
            );
        }

        if let Some(approval_threshold) = self.approval_threshold {
            require!(
                approval_threshold <= 10000,
                crate::error::GovernanceError::InvalidThreshold
            );
        }

        if let Some(veto_threshold) = self.veto_threshold {
            require!(
                veto_threshold <= 10000,
                crate::error::GovernanceError::InvalidThreshold
            );
        }

        if let Some(fee_rate) = self.fee_rate {
            require!(
                fee_rate <= 10000,
                crate::error::GovernanceError::InvalidFeeRate
            );
        }

        if let Some(voting_period) = self.voting_period {
            // Validate voting period based on test mode or test mode flag in update
            let test_mode = self.test_mode.unwrap_or(current_test_mode);

            if test_mode {
                require!(
                    voting_period >= 30, // Test mode: at least 30 seconds
                    crate::error::GovernanceError::InvalidVotingPeriod
                );
                require!(
                    voting_period <= 3600, // Test mode: maximum 1 hour
                    crate::error::GovernanceError::InvalidVotingPeriod
                );
            } else {
                require!(
                    voting_period >= 86400, // Production mode: at least 1 day
                    crate::error::GovernanceError::InvalidVotingPeriod
                );
                require!(
                    voting_period <= 2592000, // Production mode: maximum 30 days
                    crate::error::GovernanceError::InvalidVotingPeriod
                );
            }
        }

        Ok(())
    }

    /// Apply update to configuration
    pub fn apply_to(&self, config: &mut GovernanceConfig) {
        if let Some(proposal_deposit) = self.proposal_deposit {
            config.proposal_deposit = proposal_deposit;
        }
        if let Some(voting_period) = self.voting_period {
            config.voting_period = voting_period;
        }
        if let Some(participation_threshold) = self.participation_threshold {
            config.participation_threshold = participation_threshold;
        }
        if let Some(approval_threshold) = self.approval_threshold {
            config.approval_threshold = approval_threshold;
        }
        if let Some(veto_threshold) = self.veto_threshold {
            config.veto_threshold = veto_threshold;
        }
        if let Some(fee_rate) = self.fee_rate {
            config.fee_rate = fee_rate;
        }
        if let Some(test_mode) = self.test_mode {
            config.test_mode = test_mode;
        }
        config.updated_at = Clock::get().unwrap().unix_timestamp;
    }
}

/// Governance system constants
pub mod governance_constants {
    /// Default voting period (14 days)
    pub const DEFAULT_VOTING_PERIOD: u64 = 14 * 24 * 60 * 60;
    /// Default participation threshold requirement (40%)
    pub const DEFAULT_PARTICIPATION_THRESHOLD: u16 = 4000;
    /// Default approval threshold requirement (50%)
    pub const DEFAULT_APPROVAL_THRESHOLD: u16 = 5000;
    /// Default veto threshold (30%)
    pub const DEFAULT_VETO_THRESHOLD: u16 = 3000;
    /// Default committee fee rate (10%)
    pub const DEFAULT_FEE_RATE: u16 = 1000;
    /// Default proposal deposit (100 USDC, needs adjustment based on precision)
    pub const DEFAULT_PROPOSAL_DEPOSIT: u64 = 100_000_000; // Assuming USDC 6 decimal places

    /// Basis points denominator (100% = 10000 basis points)
    pub const BASIS_POINTS_DENOMINATOR: u64 = 10000;
}
