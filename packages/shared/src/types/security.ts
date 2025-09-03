/**
 * Security and Certificate Types
 */

export interface Certificate {
  id: string;
  domain: string;
  type: CertificateType;
  status: CertificateStatus;
  validFrom: Date;
  validTo: Date;
  privateKey?: string; // encrypted
  publicKey: string;
  certificateChain: string[];
  issuer: string;
  createdAt: Date;
}

export enum CertificateType {
  SELF_SIGNED = 'self-signed',
  LETS_ENCRYPT = 'lets-encrypt',
  CUSTOM = 'custom'
}

export enum CertificateStatus {
  PENDING = 'pending',
  VALID = 'valid',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  ERROR = 'error'
}

export interface SecurityScanResult {
  id: string;
  targetId: string; // VM or App ID
  scanType: SecurityScanType;
  status: ScanStatus;
  startedAt: Date;
  completedAt?: Date;
  findings: SecurityFinding[];
  score: number; // 0-100
  recommendations: string[];
}

export enum SecurityScanType {
  CODE_ANALYSIS = 'code-analysis',
  DEPENDENCY_CHECK = 'dependency-check',
  CONTAINER_SCAN = 'container-scan',
  NETWORK_SCAN = 'network-scan'
}

export enum ScanStatus {
  PENDING = 'pending',
  SCANNING = 'scanning',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface SecurityFinding {
  id: string;
  severity: SecuritySeverity;
  category: SecurityCategory;
  title: string;
  description: string;
  file?: string;
  line?: number;
  recommendation: string;
  references?: string[];
}

export enum SecuritySeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium', 
  LOW = 'low',
  INFO = 'info'
}

export enum SecurityCategory {
  VULNERABILITY = 'vulnerability',
  MALWARE = 'malware',
  CONFIGURATION = 'configuration',
  COMPLIANCE = 'compliance',
  BEST_PRACTICES = 'best-practices'
}