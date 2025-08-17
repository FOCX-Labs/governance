/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/governance_system.json`.
 */
export type GovernanceSystem = {
  "address": "9GqiBXHh7e5gREwHU6PKHDaQsLuYfqHQ2az2sBLXdaTv",
  "metadata": {
    "name": "governanceSystem",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "addCommitteeMember",
      "docs": [
        "Add committee member"
      ],
      "discriminator": [
        78,
        231,
        152,
        91,
        24,
        13,
        255,
        82
      ],
      "accounts": [
        {
          "name": "governanceConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "Only administrator can add members"
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "member",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "addRuleDocument",
      "docs": [
        "Add rule document"
      ],
      "discriminator": [
        34,
        104,
        133,
        233,
        0,
        13,
        70,
        228
      ],
      "accounts": [
        {
          "name": "ruleRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  117,
                  108,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "governanceConfig",
          "docs": [
            "Governance configuration account for permission verification"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "Only administrator can add rule documents"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "category",
          "type": "string"
        },
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "url",
          "type": "string"
        },
        {
          "name": "hash",
          "type": "string"
        }
      ]
    },
    {
      "name": "castVote",
      "docs": [
        "Cast vote"
      ],
      "discriminator": [
        20,
        212,
        15,
        189,
        69,
        180,
        69,
        151
      ],
      "accounts": [
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "proposalId"
              }
            ]
          }
        },
        {
          "name": "vote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "proposalId"
              },
              {
                "kind": "account",
                "path": "voter"
              }
            ]
          }
        },
        {
          "name": "governanceConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "voter",
          "docs": [
            "Voter (must be committee member)"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "voterTokenAccount",
          "docs": [
            "Voter's token account"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "voter"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "governance_config.committee_token_mint",
                "account": "governanceConfig"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "committeeTokenMint",
          "docs": [
            "Committee token mint"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "proposalId",
          "type": "u64"
        },
        {
          "name": "voteType",
          "type": {
            "defined": {
              "name": "voteType"
            }
          }
        }
      ]
    },
    {
      "name": "closeGovernanceConfig",
      "docs": [
        "Close governance configuration"
      ],
      "discriminator": [
        20,
        131,
        54,
        71,
        141,
        77,
        178,
        161
      ],
      "accounts": [
        {
          "name": "governanceConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "Only administrator can close configuration"
          ],
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "closeVote",
      "docs": [
        "Close vote account"
      ],
      "discriminator": [
        137,
        152,
        87,
        249,
        170,
        239,
        133,
        59
      ],
      "accounts": [
        {
          "name": "vote",
          "writable": true
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "governanceConfig",
          "docs": [
            "Governance config to verify authority"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "createProposal",
      "docs": [
        "Create proposal"
      ],
      "discriminator": [
        132,
        116,
        68,
        174,
        216,
        160,
        198,
        22
      ],
      "accounts": [
        {
          "name": "proposal",
          "writable": true
        },
        {
          "name": "governanceConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "proposer",
          "docs": [
            "Proposal proposer (any user can create proposals)"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "proposerTokenAccount",
          "docs": [
            "Proposer's USDC token account (for deposit)"
          ],
          "writable": true
        },
        {
          "name": "governanceTokenVault",
          "docs": [
            "Governance system token vault (for storing deposits)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "proposalType",
          "type": {
            "defined": {
              "name": "proposalType"
            }
          }
        },
        {
          "name": "executionData",
          "type": {
            "option": {
              "defined": {
                "name": "executionData"
              }
            }
          }
        },
        {
          "name": "customDepositRaw",
          "type": {
            "option": "u64"
          }
        }
      ],
      "returns": "u64"
    },
    {
      "name": "createRuleRegistry",
      "docs": [
        "Create rule registry"
      ],
      "discriminator": [
        155,
        35,
        85,
        101,
        90,
        225,
        147,
        156
      ],
      "accounts": [
        {
          "name": "ruleRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  117,
                  108,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "governanceConfig",
          "docs": [
            "Governance configuration account for permission verification"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "Only administrator can create rule registry"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "executeProposal",
      "docs": [
        "Execute proposal (simplified version)"
      ],
      "discriminator": [
        186,
        60,
        116,
        133,
        108,
        128,
        111,
        28
      ],
      "accounts": [
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "proposalId"
              }
            ]
          }
        },
        {
          "name": "governanceConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "proposalId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "finalizeProposal",
      "docs": [
        "Finalize proposal"
      ],
      "discriminator": [
        23,
        68,
        51,
        167,
        109,
        173,
        187,
        164
      ],
      "accounts": [
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "proposalId"
              }
            ]
          }
        },
        {
          "name": "governanceConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "committeeTokenMint",
          "docs": [
            "Committee token mint (for calculating voting power)"
          ]
        },
        {
          "name": "proposerTokenAccount",
          "docs": [
            "Proposer's token account (for deposit refund)"
          ],
          "writable": true
        },
        {
          "name": "governanceTokenVault",
          "docs": [
            "Governance system token account (for deposit handling)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "governanceAuthority",
          "docs": [
            "Governance system authority (for signing transfers)"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "docs": [
            "Token program (for deposit transfers)"
          ],
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "proposalId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "findDocumentsByCategory",
      "docs": [
        "Find rule documents by category"
      ],
      "discriminator": [
        183,
        25,
        110,
        193,
        90,
        112,
        43,
        169
      ],
      "accounts": [
        {
          "name": "ruleRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  117,
                  108,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "category",
          "type": "string"
        }
      ],
      "returns": {
        "vec": {
          "defined": {
            "name": "ruleDocument"
          }
        }
      }
    },
    {
      "name": "getRuleDocuments",
      "docs": [
        "Get rule documents information"
      ],
      "discriminator": [
        152,
        87,
        152,
        51,
        233,
        216,
        149,
        238
      ],
      "accounts": [
        {
          "name": "ruleRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  117,
                  108,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        }
      ],
      "args": [],
      "returns": {
        "vec": {
          "defined": {
            "name": "ruleDocument"
          }
        }
      }
    },
    {
      "name": "initializeGovernance",
      "docs": [
        "Initialize governance system"
      ],
      "discriminator": [
        171,
        87,
        101,
        237,
        27,
        107,
        201,
        57
      ],
      "accounts": [
        {
          "name": "governanceConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "committeeTokenMint",
          "docs": [
            "Committee token mint"
          ]
        },
        {
          "name": "usdcTokenMint",
          "docs": [
            "USDC token mint (for proposal deposits)"
          ]
        },
        {
          "name": "authority",
          "docs": [
            "System administrator"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "proposalDeposit",
          "type": "u64"
        },
        {
          "name": "votingPeriod",
          "type": "u64"
        },
        {
          "name": "participationThreshold",
          "type": "u16"
        },
        {
          "name": "approvalThreshold",
          "type": "u16"
        },
        {
          "name": "vetoThreshold",
          "type": "u16"
        },
        {
          "name": "feeRate",
          "type": "u16"
        },
        {
          "name": "testMode",
          "type": "bool"
        }
      ]
    },
    {
      "name": "initializeTokenVault",
      "docs": [
        "Initialize governance system token vault"
      ],
      "discriminator": [
        64,
        202,
        113,
        205,
        22,
        210,
        178,
        225
      ],
      "accounts": [
        {
          "name": "tokenVault",
          "docs": [
            "Token vault account (PDA)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "Token mint"
          ]
        },
        {
          "name": "governanceAuthority",
          "docs": [
            "Governance authority (PDA)"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "payer",
          "docs": [
            "Payer account"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "docs": [
            "System program"
          ],
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "docs": [
            "Token program"
          ],
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "docs": [
            "Rent sysvar"
          ],
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "removeCommitteeMember",
      "docs": [
        "Remove committee member"
      ],
      "discriminator": [
        4,
        79,
        200,
        47,
        204,
        77,
        136,
        71
      ],
      "accounts": [
        {
          "name": "governanceConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "Only administrator can remove members"
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "member",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "removeRuleDocument",
      "docs": [
        "Remove rule document"
      ],
      "discriminator": [
        210,
        148,
        126,
        196,
        92,
        240,
        205,
        61
      ],
      "accounts": [
        {
          "name": "ruleRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  117,
                  108,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "governanceConfig",
          "docs": [
            "Governance configuration account for permission verification"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "Only administrator can remove rule documents"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "documentIndex",
          "type": "u32"
        }
      ]
    },
    {
      "name": "updateGovernanceConfig",
      "docs": [
        "Update governance configuration"
      ],
      "discriminator": [
        140,
        45,
        181,
        17,
        77,
        67,
        157,
        248
      ],
      "accounts": [
        {
          "name": "governanceConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "Only administrator can update configuration"
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "configUpdate",
          "type": {
            "defined": {
              "name": "governanceConfigUpdate"
            }
          }
        }
      ]
    },
    {
      "name": "updateRuleDocument",
      "docs": [
        "Update rule document"
      ],
      "discriminator": [
        149,
        101,
        178,
        100,
        99,
        26,
        62,
        64
      ],
      "accounts": [
        {
          "name": "ruleRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  117,
                  108,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "governanceConfig",
          "docs": [
            "Governance configuration account for permission verification"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "Only administrator can update rule documents"
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "documentIndex",
          "type": "u32"
        },
        {
          "name": "newUrl",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "newHash",
          "type": {
            "option": "string"
          }
        }
      ]
    },
    {
      "name": "updateTotalVotingPower",
      "docs": [
        "Update total voting power"
      ],
      "discriminator": [
        223,
        131,
        178,
        127,
        48,
        141,
        160,
        48
      ],
      "accounts": [
        {
          "name": "governanceConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "Only administrator can update"
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newTotalVotingPower",
          "type": "u64"
        }
      ]
    },
    {
      "name": "verifyRuleDocument",
      "docs": [
        "Verify rule document hash"
      ],
      "discriminator": [
        190,
        225,
        184,
        149,
        93,
        131,
        121,
        108
      ],
      "accounts": [
        {
          "name": "ruleRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  117,
                  108,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "documentIndex",
          "type": "u32"
        },
        {
          "name": "expectedHash",
          "type": "string"
        }
      ],
      "returns": "bool"
    }
  ],
  "accounts": [
    {
      "name": "governanceConfig",
      "discriminator": [
        81,
        63,
        124,
        107,
        210,
        100,
        145,
        70
      ]
    },
    {
      "name": "proposal",
      "discriminator": [
        26,
        94,
        189,
        187,
        116,
        136,
        53,
        33
      ]
    },
    {
      "name": "ruleRegistry",
      "discriminator": [
        66,
        237,
        5,
        117,
        215,
        77,
        21,
        169
      ]
    },
    {
      "name": "vote",
      "discriminator": [
        96,
        91,
        104,
        57,
        145,
        35,
        172,
        155
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "governanceNotInitialized",
      "msg": "Governance system not initialized"
    },
    {
      "code": 6001,
      "name": "governanceAlreadyInitialized",
      "msg": "Governance system already initialized"
    },
    {
      "code": 6002,
      "name": "invalidAuthority",
      "msg": "Invalid authority"
    },
    {
      "code": 6003,
      "name": "unauthorized",
      "msg": "Unauthorized operation"
    },
    {
      "code": 6004,
      "name": "invalidThreshold",
      "msg": "Invalid threshold value"
    },
    {
      "code": 6005,
      "name": "invalidFeeRate",
      "msg": "Invalid fee rate"
    },
    {
      "code": 6006,
      "name": "invalidVotingPeriod",
      "msg": "Invalid voting period"
    },
    {
      "code": 6007,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6008,
      "name": "proposalNotFound",
      "msg": "Proposal not found"
    },
    {
      "code": 6009,
      "name": "invalidProposalType",
      "msg": "Invalid proposal type"
    },
    {
      "code": 6010,
      "name": "proposalNotActive",
      "msg": "Proposal not active"
    },
    {
      "code": 6011,
      "name": "proposalNotExecutable",
      "msg": "Proposal not executable"
    },
    {
      "code": 6012,
      "name": "votingPeriodEnded",
      "msg": "Voting period ended"
    },
    {
      "code": 6013,
      "name": "votingPeriodNotEnded",
      "msg": "Voting period not ended"
    },
    {
      "code": 6014,
      "name": "invalidProposalTitleLength",
      "msg": "Invalid proposal title length"
    },
    {
      "code": 6015,
      "name": "invalidProposalDescriptionLength",
      "msg": "Invalid proposal description length"
    },
    {
      "code": 6016,
      "name": "insufficientProposalDeposit",
      "msg": "Insufficient proposal deposit"
    },
    {
      "code": 6017,
      "name": "proposalNotFinalized",
      "msg": "Proposal not finalized"
    },
    {
      "code": 6018,
      "name": "proposalNotVetoed",
      "msg": "Proposal not vetoed"
    },
    {
      "code": 6019,
      "name": "alreadyVoted",
      "msg": "Already voted"
    },
    {
      "code": 6020,
      "name": "voteNotFound",
      "msg": "Vote not found"
    },
    {
      "code": 6021,
      "name": "voteAlreadyRevoked",
      "msg": "Vote already revoked"
    },
    {
      "code": 6022,
      "name": "insufficientVotingPower",
      "msg": "Insufficient voting power"
    },
    {
      "code": 6023,
      "name": "invalidVoteType",
      "msg": "Invalid vote type"
    },
    {
      "code": 6024,
      "name": "cannotRevokeVote",
      "msg": "Cannot revoke vote"
    },
    {
      "code": 6025,
      "name": "committeeFull",
      "msg": "Committee is full"
    },
    {
      "code": 6026,
      "name": "memberAlreadyExists",
      "msg": "Member already exists"
    },
    {
      "code": 6027,
      "name": "memberNotFound",
      "msg": "Member not found"
    },
    {
      "code": 6028,
      "name": "notCommitteeMember",
      "msg": "Not a committee member"
    },
    {
      "code": 6029,
      "name": "ruleRegistryNotFound",
      "msg": "Rule registry not found"
    },
    {
      "code": 6030,
      "name": "ruleDocumentNotFound",
      "msg": "Rule document not found"
    },
    {
      "code": 6031,
      "name": "duplicateRuleDocument",
      "msg": "Duplicate rule document"
    },
    {
      "code": 6032,
      "name": "tooManyRuleDocuments",
      "msg": "Too many rule documents"
    },
    {
      "code": 6033,
      "name": "invalidCategoryLength",
      "msg": "Invalid category length"
    },
    {
      "code": 6034,
      "name": "invalidTitleLength",
      "msg": "Invalid title length"
    },
    {
      "code": 6035,
      "name": "invalidUrlLength",
      "msg": "Invalid URL length"
    },
    {
      "code": 6036,
      "name": "invalidHashLength",
      "msg": "Invalid hash length"
    },
    {
      "code": 6037,
      "name": "invalidUrlFormat",
      "msg": "Invalid URL format"
    },
    {
      "code": 6038,
      "name": "invalidHashFormat",
      "msg": "Invalid hash format"
    },
    {
      "code": 6039,
      "name": "invalidMerchantAddress",
      "msg": "Invalid merchant address"
    },
    {
      "code": 6040,
      "name": "productNotFound",
      "msg": "Product not found"
    },
    {
      "code": 6041,
      "name": "orderNotFound",
      "msg": "Order not found"
    },
    {
      "code": 6042,
      "name": "invalidViolationType",
      "msg": "Invalid violation type"
    },
    {
      "code": 6043,
      "name": "tooManyEvidenceUrls",
      "msg": "Too many evidence URLs"
    },
    {
      "code": 6044,
      "name": "invalidSlashAmount",
      "msg": "Invalid slash amount"
    },
    {
      "code": 6045,
      "name": "invalidDisputeParties",
      "msg": "Invalid dispute parties"
    },
    {
      "code": 6046,
      "name": "notAuthorizedForDispute",
      "msg": "Not authorized for dispute"
    },
    {
      "code": 6047,
      "name": "invalidDisputeType",
      "msg": "Invalid dispute type"
    },
    {
      "code": 6048,
      "name": "invalidResolutionRequest",
      "msg": "Invalid resolution request"
    },
    {
      "code": 6049,
      "name": "orderNotInDispute",
      "msg": "Order not in dispute"
    },
    {
      "code": 6050,
      "name": "invalidTokenMint",
      "msg": "Invalid token mint"
    },
    {
      "code": 6051,
      "name": "insufficientTokenBalance",
      "msg": "Insufficient token balance"
    },
    {
      "code": 6052,
      "name": "tokenTransferFailed",
      "msg": "Token transfer failed"
    },
    {
      "code": 6053,
      "name": "invalidTokenAccount",
      "msg": "Invalid token account"
    },
    {
      "code": 6054,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6055,
      "name": "arithmeticUnderflow",
      "msg": "Arithmetic underflow"
    },
    {
      "code": 6056,
      "name": "divisionByZero",
      "msg": "Division by zero"
    },
    {
      "code": 6057,
      "name": "invalidTimestamp",
      "msg": "Invalid timestamp"
    },
    {
      "code": 6058,
      "name": "deadlineExceeded",
      "msg": "Deadline exceeded"
    },
    {
      "code": 6059,
      "name": "tooEarly",
      "msg": "Too early"
    },
    {
      "code": 6060,
      "name": "invalidAccountOwner",
      "msg": "Invalid account owner"
    },
    {
      "code": 6061,
      "name": "invalidAccountData",
      "msg": "Invalid account data"
    },
    {
      "code": 6062,
      "name": "accountNotInitialized",
      "msg": "Account not initialized"
    },
    {
      "code": 6063,
      "name": "accountAlreadyInitialized",
      "msg": "Account already initialized"
    },
    {
      "code": 6064,
      "name": "invalidPda",
      "msg": "Invalid PDA"
    },
    {
      "code": 6065,
      "name": "invalidAccountSeeds",
      "msg": "Invalid account seeds"
    },
    {
      "code": 6066,
      "name": "executionFailed",
      "msg": "Execution failed"
    },
    {
      "code": 6067,
      "name": "invalidExecutionData",
      "msg": "Invalid execution data"
    },
    {
      "code": 6068,
      "name": "cpiCallFailed",
      "msg": "CPI call failed"
    },
    {
      "code": 6069,
      "name": "invalidInput",
      "msg": "Invalid input"
    },
    {
      "code": 6070,
      "name": "operationNotAllowed",
      "msg": "Operation not allowed"
    },
    {
      "code": 6071,
      "name": "featureNotImplemented",
      "msg": "Feature not implemented"
    }
  ],
  "types": [
    {
      "name": "arbitrationDecision",
      "docs": [
        "Arbitration decision"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "refundUser"
          },
          {
            "name": "supportMerchant"
          },
          {
            "name": "partialRefund",
            "fields": [
              "u64"
            ]
          },
          {
            "name": "requireOfflineResolution"
          }
        ]
      }
    },
    {
      "name": "configUpdateData",
      "docs": [
        "Configuration update data"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "configUpdate",
            "docs": [
              "Configuration update parameters"
            ],
            "type": {
              "defined": {
                "name": "governanceConfigUpdate"
              }
            }
          }
        ]
      }
    },
    {
      "name": "disputeProposalData",
      "docs": [
        "Trade dispute arbitration proposal data"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "userAddress",
            "docs": [
              "User address"
            ],
            "type": "pubkey"
          },
          {
            "name": "merchantAddress",
            "docs": [
              "Merchant address"
            ],
            "type": "pubkey"
          },
          {
            "name": "orderAddress",
            "docs": [
              "Order address"
            ],
            "type": "pubkey"
          },
          {
            "name": "disputeType",
            "docs": [
              "Dispute type"
            ],
            "type": "string"
          },
          {
            "name": "evidenceUrls",
            "docs": [
              "Evidence file URL list"
            ],
            "type": {
              "vec": "string"
            }
          },
          {
            "name": "requestedResolution",
            "docs": [
              "Requested resolution"
            ],
            "type": "string"
          },
          {
            "name": "arbitrationDecision",
            "docs": [
              "Arbitration decision (filled after voting)"
            ],
            "type": {
              "option": {
                "defined": {
                  "name": "arbitrationDecision"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "executionData",
      "docs": [
        "Execution data"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "slash",
            "fields": [
              {
                "defined": {
                  "name": "slashProposalData"
                }
              }
            ]
          },
          {
            "name": "dispute",
            "fields": [
              {
                "defined": {
                  "name": "disputeProposalData"
                }
              }
            ]
          },
          {
            "name": "ruleUpdate",
            "fields": [
              {
                "defined": {
                  "name": "ruleUpdateData"
                }
              }
            ]
          },
          {
            "name": "configUpdate",
            "fields": [
              {
                "defined": {
                  "name": "configUpdateData"
                }
              }
            ]
          }
        ]
      }
    },
    {
      "name": "governanceConfig",
      "docs": [
        "Governance system configuration account"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Administrator address"
            ],
            "type": "pubkey"
          },
          {
            "name": "committeeTokenMint",
            "docs": [
              "Committee token mint address (fixed to specified SPL Token)"
            ],
            "type": "pubkey"
          },
          {
            "name": "committeeMembers",
            "docs": [
              "Committee member address array (maximum 10 members)"
            ],
            "type": {
              "array": [
                {
                  "option": "pubkey"
                },
                10
              ]
            }
          },
          {
            "name": "committeeMemberCount",
            "docs": [
              "Committee member count"
            ],
            "type": "u8"
          },
          {
            "name": "proposalDeposit",
            "docs": [
              "Proposal deposit amount (100 USDC)"
            ],
            "type": "u64"
          },
          {
            "name": "votingPeriod",
            "docs": [
              "Voting period (14 days, in seconds)"
            ],
            "type": "u64"
          },
          {
            "name": "participationThreshold",
            "docs": [
              "Participation threshold requirement (40% = 4000 basis points)"
            ],
            "type": "u16"
          },
          {
            "name": "approvalThreshold",
            "docs": [
              "Approval threshold requirement (50% = 5000 basis points)"
            ],
            "type": "u16"
          },
          {
            "name": "vetoThreshold",
            "docs": [
              "Veto threshold (30% = 3000 basis points)"
            ],
            "type": "u16"
          },
          {
            "name": "feeRate",
            "docs": [
              "Committee fee rate (10% = 1000 basis points)"
            ],
            "type": "u16"
          },
          {
            "name": "totalVotingPower",
            "docs": [
              "Total voting power"
            ],
            "type": "u64"
          },
          {
            "name": "proposalCounter",
            "docs": [
              "Proposal counter"
            ],
            "type": "u64"
          },
          {
            "name": "createdAt",
            "docs": [
              "Creation time"
            ],
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "docs": [
              "Last update time"
            ],
            "type": "i64"
          },
          {
            "name": "testMode",
            "docs": [
              "Test mode flag"
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "governanceConfigUpdate",
      "docs": [
        "Governance configuration update parameters"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposalDeposit",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "votingPeriod",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "participationThreshold",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "approvalThreshold",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "vetoThreshold",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "feeRate",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "testMode",
            "type": {
              "option": "bool"
            }
          }
        ]
      }
    },
    {
      "name": "proposal",
      "docs": [
        "Proposal account"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "docs": [
              "Proposal ID"
            ],
            "type": "u64"
          },
          {
            "name": "proposer",
            "docs": [
              "Proposal proposer"
            ],
            "type": "pubkey"
          },
          {
            "name": "proposalType",
            "docs": [
              "Proposal type"
            ],
            "type": {
              "defined": {
                "name": "proposalType"
              }
            }
          },
          {
            "name": "title",
            "docs": [
              "Proposal title"
            ],
            "type": "string"
          },
          {
            "name": "description",
            "docs": [
              "Proposal description"
            ],
            "type": "string"
          },
          {
            "name": "depositAmount",
            "docs": [
              "Deposit amount"
            ],
            "type": "u64"
          },
          {
            "name": "createdAt",
            "docs": [
              "Creation time"
            ],
            "type": "i64"
          },
          {
            "name": "votingStart",
            "docs": [
              "Voting start time"
            ],
            "type": "i64"
          },
          {
            "name": "votingEnd",
            "docs": [
              "Voting end time"
            ],
            "type": "i64"
          },
          {
            "name": "status",
            "docs": [
              "Proposal status"
            ],
            "type": {
              "defined": {
                "name": "proposalStatus"
              }
            }
          },
          {
            "name": "yesVotes",
            "docs": [
              "Yes votes"
            ],
            "type": "u64"
          },
          {
            "name": "noVotes",
            "docs": [
              "No votes"
            ],
            "type": "u64"
          },
          {
            "name": "abstainVotes",
            "docs": [
              "Abstain votes"
            ],
            "type": "u64"
          },
          {
            "name": "vetoVotes",
            "docs": [
              "Veto votes"
            ],
            "type": "u64"
          },
          {
            "name": "totalVotes",
            "docs": [
              "Total votes"
            ],
            "type": "u64"
          },
          {
            "name": "executionData",
            "docs": [
              "Execution data"
            ],
            "type": {
              "option": {
                "defined": {
                  "name": "executionData"
                }
              }
            }
          },
          {
            "name": "executionResult",
            "docs": [
              "Execution result"
            ],
            "type": {
              "option": "string"
            }
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "proposalStatus",
      "docs": [
        "Proposal status"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "passed"
          },
          {
            "name": "rejected"
          },
          {
            "name": "vetoed"
          },
          {
            "name": "executed"
          }
        ]
      }
    },
    {
      "name": "proposalType",
      "docs": [
        "Proposal type"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "slashMerchant"
          },
          {
            "name": "disputeArbitration"
          },
          {
            "name": "ruleUpdate"
          },
          {
            "name": "configUpdate"
          }
        ]
      }
    },
    {
      "name": "ruleDocument",
      "docs": [
        "Rule document structure"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "category",
            "docs": [
              "Rule category"
            ],
            "type": "string"
          },
          {
            "name": "title",
            "docs": [
              "Rule title"
            ],
            "type": "string"
          },
          {
            "name": "url",
            "docs": [
              "IPFS/Arweave URL"
            ],
            "type": "string"
          },
          {
            "name": "hash",
            "docs": [
              "Document hash"
            ],
            "type": "string"
          },
          {
            "name": "createdAt",
            "docs": [
              "Creation time"
            ],
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "docs": [
              "Update time"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "ruleOperation",
      "docs": [
        "Rule operation type"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "add"
          },
          {
            "name": "update"
          },
          {
            "name": "remove"
          }
        ]
      }
    },
    {
      "name": "ruleRegistry",
      "docs": [
        "Rule registry account"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Administrator address"
            ],
            "type": "pubkey"
          },
          {
            "name": "ruleDocuments",
            "docs": [
              "Rule document list"
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "ruleDocument"
                }
              }
            }
          },
          {
            "name": "lastUpdated",
            "docs": [
              "Last update time"
            ],
            "type": "i64"
          },
          {
            "name": "version",
            "docs": [
              "Version"
            ],
            "type": "u32"
          },
          {
            "name": "createdAt",
            "docs": [
              "Creation time"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ruleUpdateData",
      "docs": [
        "Rule update data"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "operation",
            "docs": [
              "Operation type"
            ],
            "type": {
              "defined": {
                "name": "ruleOperation"
              }
            }
          },
          {
            "name": "documentIndex",
            "docs": [
              "Document index (for update/delete)"
            ],
            "type": {
              "option": "u32"
            }
          },
          {
            "name": "documentData",
            "docs": [
              "New document data (for add/update)"
            ],
            "type": {
              "option": {
                "defined": {
                  "name": "ruleDocument"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "slashProposalData",
      "docs": [
        "Illegal product slash proposal data"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "merchantAddress",
            "docs": [
              "Merchant address"
            ],
            "type": "pubkey"
          },
          {
            "name": "productAddress",
            "docs": [
              "Illegal product address (optional)"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "orderAddress",
            "docs": [
              "Illegal order address (optional)"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "violationType",
            "docs": [
              "Violation type"
            ],
            "type": "string"
          },
          {
            "name": "evidenceUrls",
            "docs": [
              "Evidence file URL list"
            ],
            "type": {
              "vec": "string"
            }
          },
          {
            "name": "slashAmount",
            "docs": [
              "Slash amount"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vote",
      "docs": [
        "Vote record account"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposalId",
            "docs": [
              "Proposal ID"
            ],
            "type": "u64"
          },
          {
            "name": "voter",
            "docs": [
              "Voter address"
            ],
            "type": "pubkey"
          },
          {
            "name": "voteType",
            "docs": [
              "Vote type"
            ],
            "type": {
              "defined": {
                "name": "voteType"
              }
            }
          },
          {
            "name": "timestamp",
            "docs": [
              "Vote time"
            ],
            "type": "i64"
          },
          {
            "name": "tokenBalanceSnapshot",
            "docs": [
              "Voter token balance snapshot"
            ],
            "type": "u64"
          },
          {
            "name": "isRevoked",
            "docs": [
              "Whether revoked"
            ],
            "type": "bool"
          },
          {
            "name": "revokedAt",
            "docs": [
              "Revocation time"
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "voteType",
      "docs": [
        "Vote type"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "yes"
          },
          {
            "name": "no"
          },
          {
            "name": "abstain"
          },
          {
            "name": "noWithVeto"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "seed",
      "type": "string",
      "value": "\"anchor\""
    }
  ]
};
