use anchor_lang::prelude::*;

/// Rule registry account
#[account]
#[derive(InitSpace)]
pub struct RuleRegistry {
    /// Administrator address
    pub authority: Pubkey,
    /// Rule document list
    #[max_len(50)]
    pub rule_documents: Vec<RuleDocument>,
    /// Last update time
    pub last_updated: i64,
    /// Version
    pub version: u32,
    /// Creation time
    pub created_at: i64,
    /// PDA bump
    pub bump: u8,
}

impl RuleRegistry {
    /// Add rule document
    pub fn add_document(&mut self, document: RuleDocument) -> Result<()> {
        require!(
            self.rule_documents.len() < MAX_RULE_DOCUMENTS,
            crate::error::GovernanceError::TooManyRuleDocuments
        );

        // Check if document with same category and title already exists
        for existing_doc in &self.rule_documents {
            require!(
                !(existing_doc.category == document.category
                    && existing_doc.title == document.title),
                crate::error::GovernanceError::DuplicateRuleDocument
            );
        }

        self.rule_documents.push(document);
        self.version += 1;
        self.last_updated = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Update rule document
    pub fn update_document(
        &mut self,
        index: usize,
        new_url: Option<String>,
        new_hash: Option<String>,
    ) -> Result<()> {
        require!(
            index < self.rule_documents.len(),
            crate::error::GovernanceError::RuleDocumentNotFound
        );

        let document = &mut self.rule_documents[index];

        if let Some(url) = new_url {
            require!(
                url.len() <= MAX_URL_LENGTH,
                crate::error::GovernanceError::InvalidUrlLength
            );
            document.url = url;
        }

        if let Some(hash) = new_hash {
            require!(
                hash.len() <= MAX_HASH_LENGTH,
                crate::error::GovernanceError::InvalidHashLength
            );
            document.hash = hash;
        }

        document.updated_at = Clock::get()?.unix_timestamp;
        self.version += 1;
        self.last_updated = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Remove rule document
    pub fn remove_document(&mut self, index: usize) -> Result<()> {
        require!(
            index < self.rule_documents.len(),
            crate::error::GovernanceError::RuleDocumentNotFound
        );

        self.rule_documents.remove(index);
        self.version += 1;
        self.last_updated = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Find documents by category
    pub fn find_documents_by_category(&self, category: &str) -> Vec<&RuleDocument> {
        self.rule_documents
            .iter()
            .filter(|doc| doc.category == category)
            .collect()
    }

    /// Verify document hash
    pub fn verify_document_hash(&self, index: usize, expected_hash: &str) -> bool {
        if let Some(document) = self.rule_documents.get(index) {
            document.hash == expected_hash
        } else {
            false
        }
    }
}

/// Rule document structure
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, InitSpace)]
pub struct RuleDocument {
    /// Rule category
    #[max_len(50)]
    pub category: String,
    /// Rule title
    #[max_len(200)]
    pub title: String,
    /// IPFS/Arweave URL
    #[max_len(500)]
    pub url: String,
    /// Document hash
    #[max_len(64)]
    pub hash: String,
    /// Creation time
    pub created_at: i64,
    /// Update time
    pub updated_at: i64,
}

impl RuleDocument {
    /// Create new rule document
    pub fn new(category: String, title: String, url: String, hash: String) -> Result<Self> {
        require!(
            category.len() <= MAX_CATEGORY_LENGTH,
            crate::error::GovernanceError::InvalidCategoryLength
        );
        require!(
            title.len() <= MAX_TITLE_LENGTH,
            crate::error::GovernanceError::InvalidTitleLength
        );
        require!(
            url.len() <= MAX_URL_LENGTH,
            crate::error::GovernanceError::InvalidUrlLength
        );
        require!(
            hash.len() <= MAX_HASH_LENGTH,
            crate::error::GovernanceError::InvalidHashLength
        );

        let now = Clock::get()?.unix_timestamp;
        Ok(Self {
            category,
            title,
            url,
            hash,
            created_at: now,
            updated_at: now,
        })
    }

    /// Validate URL format
    pub fn validate_url(&self) -> bool {
        // Simple URL format validation
        self.url.starts_with("https://")
            || self.url.starts_with("ipfs://")
            || self.url.starts_with("ar://")
    }

    /// Validate hash format
    pub fn validate_hash(&self) -> bool {
        // Simple hash format validation (assuming SHA256)
        self.hash.len() == 64 && self.hash.chars().all(|c| c.is_ascii_hexdigit())
    }
}

/// Rule category enumeration
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum RuleCategory {
    /// Product standards
    ProductStandards,
    /// Trading rules
    TradingRules,
    /// Violation definitions
    ViolationDefinitions,
    /// Dispute resolution process
    DisputeResolution,
    /// Platform policies
    PlatformPolicies,
    /// Other categories
    Other(String),
}

impl RuleCategory {
    pub fn to_string(&self) -> String {
        match self {
            RuleCategory::ProductStandards => "product_standards".to_string(),
            RuleCategory::TradingRules => "trading_rules".to_string(),
            RuleCategory::ViolationDefinitions => "violation_definitions".to_string(),
            RuleCategory::DisputeResolution => "dispute_resolution".to_string(),
            RuleCategory::PlatformPolicies => "platform_policies".to_string(),
            RuleCategory::Other(s) => s.clone(),
        }
    }

    pub fn from_string(s: &str) -> Self {
        match s {
            "product_standards" => RuleCategory::ProductStandards,
            "trading_rules" => RuleCategory::TradingRules,
            "violation_definitions" => RuleCategory::ViolationDefinitions,
            "dispute_resolution" => RuleCategory::DisputeResolution,
            "platform_policies" => RuleCategory::PlatformPolicies,
            _ => RuleCategory::Other(s.to_string()),
        }
    }
}

/// Rule management constants
pub const MAX_RULE_DOCUMENTS: usize = 100;
pub const MAX_CATEGORY_LENGTH: usize = 50;
pub const MAX_TITLE_LENGTH: usize = 200;
pub const MAX_URL_LENGTH: usize = 500;
pub const MAX_HASH_LENGTH: usize = 64;

/// Predefined rule categories
pub mod rule_categories {
    pub const PRODUCT_STANDARDS: &str = "product_standards";
    pub const TRADING_RULES: &str = "trading_rules";
    pub const VIOLATION_DEFINITIONS: &str = "violation_definitions";
    pub const DISPUTE_RESOLUTION: &str = "dispute_resolution";
    pub const PLATFORM_POLICIES: &str = "platform_policies";
}
