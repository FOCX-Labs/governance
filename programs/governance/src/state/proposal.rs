use anchor_lang::prelude::*;

/// Proposal account
#[account]
#[derive(InitSpace)]
pub struct Proposal {
    /// Proposal ID
    pub id: u64,
    /// Proposal proposer
    pub proposer: Pubkey,
    /// Proposal type
    pub proposal_type: ProposalType,
    /// Proposal title
    #[max_len(100)]
    pub title: String,
    /// Proposal description
    #[max_len(800)]
    pub description: String,
    /// Deposit amount
    pub deposit_amount: u64,
    /// Creation time
    pub created_at: i64,
    /// Voting start time
    pub voting_start: i64,
    /// Voting end time
    pub voting_end: i64,
    /// Proposal status
    pub status: ProposalStatus,
    /// Yes votes
    pub yes_votes: u64,
    /// No votes
    pub no_votes: u64,
    /// Abstain votes
    pub abstain_votes: u64,
    /// Veto votes
    pub veto_votes: u64,
    /// Total votes
    pub total_votes: u64,
    /// Execution data
    pub execution_data: Option<ExecutionData>,
    /// Execution result
    #[max_len(500)]
    pub execution_result: Option<String>,
    /// PDA bump
    pub bump: u8,
}

impl Proposal {
    /// Check if voting is allowed
    pub fn can_vote(&self) -> bool {
        self.status == ProposalStatus::Pending
            && Clock::get().unwrap().unix_timestamp <= self.voting_end
    }

    /// Check if voting has ended
    pub fn is_voting_ended(&self) -> bool {
        Clock::get().unwrap().unix_timestamp > self.voting_end
    }

    /// Finalize proposal
    pub fn finalize(
        &mut self,
        governance_config: &crate::state::GovernanceConfig,
        total_voting_power: u64,
    ) -> Result<()> {
        require!(
            self.is_voting_ended(),
            crate::error::GovernanceError::VotingPeriodNotEnded
        );
        require!(
            self.status == ProposalStatus::Pending,
            crate::error::GovernanceError::ProposalNotActive
        );

        // Use VoteStats to uniformly determine proposal status
        let vote_stats = crate::state::vote::VoteStats {
            total_votes: self.total_votes,
            yes_votes: self.yes_votes,
            no_votes: self.no_votes,
            abstain_votes: self.abstain_votes,
            veto_votes: self.veto_votes,
            voter_count: 0, // Set to 0 temporarily, can be calculated from vote records if needed
        };

        self.status = governance_config
            .determine_proposal_status_with_vote_stats(&vote_stats, total_voting_power);

        Ok(())
    }

    /// Mark as executed
    pub fn mark_executed(&mut self, result: String) -> Result<()> {
        require!(
            self.status == ProposalStatus::Passed,
            crate::error::GovernanceError::ProposalNotExecutable
        );

        self.status = ProposalStatus::Executed;
        self.execution_result = Some(result);
        Ok(())
    }

    /// Check if can be executed
    pub fn can_execute(&self) -> bool {
        self.status == ProposalStatus::Passed
    }
}

/// Proposal type
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, InitSpace)]
pub enum ProposalType {
    /// Illegal product slash
    SlashMerchant,
    /// Trade dispute arbitration
    DisputeArbitration,
    /// Rule update
    RuleUpdate,
    /// Configuration update
    ConfigUpdate,
}

/// Proposal status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, InitSpace)]
pub enum ProposalStatus {
    /// Voting in progress
    Pending,
    /// Passed
    Passed,
    /// Rejected
    Rejected,
    /// Vetoed
    Vetoed,
    /// Executed
    Executed,
}

/// Vote type
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, InitSpace)]
pub enum VoteType {
    Yes,
    No,
    Abstain,
    NoWithVeto,
}

/// Execution data
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub enum ExecutionData {
    /// Slash proposal data
    Slash(SlashProposalData),
    /// Dispute arbitration data
    Dispute(DisputeProposalData),
    /// Rule update data
    RuleUpdate(RuleUpdateData),
    /// Configuration update data
    ConfigUpdate(ConfigUpdateData),
}

/// Illegal product slash proposal data
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct SlashProposalData {
    /// Merchant address
    pub merchant_address: Pubkey,
    /// Illegal product address (optional)
    pub product_address: Option<Pubkey>,
    /// Illegal order address (optional)
    pub order_address: Option<Pubkey>,
    /// Violation type
    #[max_len(100)]
    pub violation_type: String,
    /// Evidence file URL list
    #[max_len(10, 500)]
    pub evidence_urls: Vec<String>,
    /// Slash amount
    pub slash_amount: u64,
}

/// Trade dispute arbitration proposal data
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct DisputeProposalData {
    /// User address
    pub user_address: Pubkey,
    /// Merchant address
    pub merchant_address: Pubkey,
    /// Order address
    pub order_address: Pubkey,
    /// Dispute type
    #[max_len(100)]
    pub dispute_type: String,
    /// Evidence file URL list
    #[max_len(10, 500)]
    pub evidence_urls: Vec<String>,
    /// Requested resolution
    #[max_len(1000)]
    pub requested_resolution: String,
    /// Arbitration decision (filled after voting)
    pub arbitration_decision: Option<ArbitrationDecision>,
}

/// Arbitration decision
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub enum ArbitrationDecision {
    /// Support user, full refund
    RefundUser,
    /// Support merchant, no refund
    SupportMerchant,
    /// Partial refund
    PartialRefund(u64),
    /// Require offline resolution
    RequireOfflineResolution,
}

/// Rule update data
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct RuleUpdateData {
    /// Operation type
    pub operation: RuleOperation,
    /// Document index (for update/delete)
    pub document_index: Option<u32>,
    /// New document data (for add/update)
    pub document_data: Option<crate::state::RuleDocument>,
}

/// Rule operation type
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub enum RuleOperation {
    Add,
    Update,
    Remove,
}

/// Configuration update data
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct ConfigUpdateData {
    /// Configuration update parameters
    pub config_update: crate::state::GovernanceConfigUpdate,
}
