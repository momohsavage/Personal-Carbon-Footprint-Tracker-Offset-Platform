import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface OffsetRecord {
  user: string;
  amount: number;
  pool: string;
  payment: number;
  metadata: string;
  timestamp: number;
  status: string;
  verified: boolean;
}

interface UserOffsets {
  totalOffset: number;
  activeOffset: number;
  retiredOffset: number;
  lastOffsetTime: number;
}

interface OffsetVersion {
  updatedAmount: number;
  updateNotes: string;
  timestamp: number;
}

interface OffsetLicense {
  expiry: number;
  terms: string;
  active: boolean;
}

interface OffsetCategory {
  category: string;
  tags: string[];
}

interface Collaborator {
  role: string;
  permissions: string[];
  addedAt: number;
}

interface RevenueShare {
  percentage: number;
  totalReceived: number;
}

interface ContractState {
  admin: string;
  paused: boolean;
  totalOffsets: number;
  offsetCounter: number;
  offsetFee: number;
  balances: Map<string, number>; // CCT balances
  totalSupply: number;
  offsetters: Map<string, boolean>;
  userOffsets: Map<string, UserOffsets>;
  offsetRecords: Map<number, OffsetRecord>;
  offsetVersions: Map<string, OffsetVersion>; // Key: `${offsetId}-${version}`
  offsetLicenses: Map<string, OffsetLicense>; // Key: `${offsetId}-${licensee}`
  offsetCategories: Map<number, OffsetCategory>;
  collaborators: Map<string, Collaborator>; // Key: `${offsetId}-${collaborator}`
  revenueShares: Map<string, RevenueShare>; // Key: `${offsetId}-${participant}`
}

// Mock contract implementation
class OffsetManagerMock {
  private state: ContractState = {
    admin: "deployer",
    paused: false,
    totalOffsets: 0,
    offsetCounter: 0,
    offsetFee: 100,
    balances: new Map(),
    totalSupply: 0,
    offsetters: new Map([["deployer", true]]),
    userOffsets: new Map(),
    offsetRecords: new Map(),
    offsetVersions: new Map(),
    offsetLicenses: new Map(),
    offsetCategories: new Map(),
    collaborators: new Map(),
    revenueShares: new Map(),
  };

  private MAX_METADATA_LEN = 512;
  private MIN_OFFSET_AMOUNT = 1;
  private ERR_UNAUTHORIZED = 100;
  private ERR_PAUSED = 101;
  private ERR_INVALID_AMOUNT = 102;
  private ERR_INVALID_RECIPIENT = 103;
  private ERR_INVALID_OFFSETTER = 104;
  private ERR_ALREADY_REGISTERED = 105;
  private ERR_METADATA_TOO_LONG = 106;
  private ERR_INSUFFICIENT_PAYMENT = 107;
  private ERR_INVALID_POOL = 108;
  private ERR_OFFSET_ALREADY_RETIRED = 109;
  private ERR_INVALID_STATUS = 110;

  // Mock block-height and tx-sender for testing
  private mockBlockHeight = 1000;
  private mockStxTransfer = vi.fn((amount: number, sender: string, recipient: string) => ({ ok: true, value: true }));

  getContractAdmin(): ClarityResponse<string> {
    return { ok: true, value: this.state.admin };
  }

  isPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  getTotalOffsets(): ClarityResponse<number> {
    return { ok: true, value: this.state.totalOffsets };
  }

  getOffsetFee(): ClarityResponse<number> {
    return { ok: true, value: this.state.offsetFee };
  }

  getUserOffsets(user: string): ClarityResponse<UserOffsets> {
    return { ok: true, value: this.state.userOffsets.get(user) ?? { totalOffset: 0, activeOffset: 0, retiredOffset: 0, lastOffsetTime: 0 } };
  }

  getOffsetRecord(offsetId: number): ClarityResponse<OffsetRecord | null> {
    return { ok: true, value: this.state.offsetRecords.get(offsetId) ?? null };
  }

  getOffsetVersion(offsetId: number, version: number): ClarityResponse<OffsetVersion | null> {
    return { ok: true, value: this.state.offsetVersions.get(`${offsetId}-${version}`) ?? null };
  }

  isOffsetter(account: string): ClarityResponse<boolean> {
    return { ok: true, value: this.state.offsetters.get(account) ?? false };
  }

  getBalance(account: string): ClarityResponse<number> {
    return { ok: true, value: this.state.balances.get(account) ?? 0 };
  }

  getTotalSupply(): ClarityResponse<number> {
    return { ok: true, value: this.state.totalSupply };
  }

  verifyOffset(offsetId: number): ClarityResponse<boolean> {
    const record = this.state.offsetRecords.get(offsetId);
    if (!record) return { ok: false, value: this.ERR_INVALID_AMOUNT };
    return { ok: true, value: record.verified && record.status === "active" };
  }

  setAdmin(caller: string, newAdmin: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = false;
    return { ok: true, value: true };
  }

  addOffsetter(caller: string, offsetter: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (this.state.offsetters.has(offsetter)) {
      return { ok: false, value: this.ERR_ALREADY_REGISTERED };
    }
    this.state.offsetters.set(offsetter, true);
    return { ok: true, value: true };
  }

  removeOffsetter(caller: string, offsetter: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.offsetters.set(offsetter, false);
    return { ok: true, value: true };
  }

  setOffsetFee(caller: string, newFee: number): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.offsetFee = newFee;
    return { ok: true, value: true };
  }

  offsetEmissions(caller: string, amount: number, pool: string, metadata: string): ClarityResponse<number> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (amount < this.MIN_OFFSET_AMOUNT) {
      return { ok: false, value: this.ERR_INVALID_AMOUNT };
    }
    if (metadata.length > this.MAX_METADATA_LEN) {
      return { ok: false, value: this.ERR_METADATA_TOO_LONG };
    }
    if (!this.state.offsetters.get(caller)) {
      return { ok: false, value: this.ERR_INVALID_OFFSETTER };
    }
    if (pool === caller) {
      return { ok: false, value: this.ERR_INVALID_POOL };
    }
    const requiredPayment = amount * this.state.offsetFee;
    // Mock STX transfer
    const transferResult = this.mockStxTransfer(requiredPayment, caller, pool);
    if (!transferResult.ok) {
      return { ok: false, value: this.ERR_INSUFFICIENT_PAYMENT };
    }
    // Mint CCT
    const currentBalance = this.state.balances.get(caller) ?? 0;
    this.state.balances.set(caller, currentBalance + amount);
    this.state.totalSupply += amount;
    // Create record
    const offsetId = this.state.offsetCounter + 1;
    this.state.offsetRecords.set(offsetId, {
      user: caller,
      amount,
      pool,
      payment: requiredPayment,
      metadata,
      timestamp: this.mockBlockHeight,
      status: "active",
      verified: false,
    });
    // Update user offsets
    const currentOffsets = this.state.userOffsets.get(caller) ?? { totalOffset: 0, activeOffset: 0, retiredOffset: 0, lastOffsetTime: 0 };
    this.state.userOffsets.set(caller, {
      totalOffset: currentOffsets.totalOffset + amount,
      activeOffset: currentOffsets.activeOffset + amount,
      retiredOffset: currentOffsets.retiredOffset,
      lastOffsetTime: this.mockBlockHeight,
    });
    this.state.totalOffsets += amount;
    this.state.offsetCounter = offsetId;
    return { ok: true, value: offsetId };
  }

  retireOffset(caller: string, offsetId: number): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const record = this.state.offsetRecords.get(offsetId);
    if (!record) {
      return { ok: false, value: this.ERR_INVALID_AMOUNT };
    }
    if (caller !== record.user) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (record.status !== "active") {
      return { ok: false, value: this.ERR_OFFSET_ALREADY_RETIRED };
    }
    // Burn CCT
    const currentBalance = this.state.balances.get(caller) ?? 0;
    if (currentBalance < record.amount) {
      return { ok: false, value: this.ERR_INVALID_AMOUNT };
    }
    this.state.balances.set(caller, currentBalance - record.amount);
    this.state.totalSupply -= record.amount;
    // Update record
    record.status = "retired";
    record.verified = true;
    this.state.offsetRecords.set(offsetId, record);
    // Update user offsets
    const currentOffsets = this.state.userOffsets.get(caller)!;
    this.state.userOffsets.set(caller, {
      totalOffset: currentOffsets.totalOffset,
      activeOffset: currentOffsets.activeOffset - record.amount,
      retiredOffset: currentOffsets.retiredOffset + record.amount,
      lastOffsetTime: this.mockBlockHeight,
    });
    return { ok: true, value: true };
  }

  verifyOffsetRecord(caller: string, offsetId: number): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    const record = this.state.offsetRecords.get(offsetId);
    if (!record) {
      return { ok: false, value: this.ERR_INVALID_AMOUNT };
    }
    record.verified = true;
    this.state.offsetRecords.set(offsetId, record);
    return { ok: true, value: true };
  }

  updateOffsetVersion(caller: string, offsetId: number, version: number, newAmount: number, notes: string): ClarityResponse<boolean> {
    const record = this.state.offsetRecords.get(offsetId);
    if (!record) {
      return { ok: false, value: this.ERR_INVALID_AMOUNT };
    }
    if (caller !== record.user) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (record.status !== "active") {
      return { ok: false, value: this.ERR_INVALID_STATUS };
    }
    this.state.offsetVersions.set(`${offsetId}-${version}`, {
      updatedAmount: newAmount,
      updateNotes: notes,
      timestamp: this.mockBlockHeight,
    });
    return { ok: true, value: true };
  }

  grantOffsetLicense(caller: string, offsetId: number, licensee: string, duration: number, terms: string): ClarityResponse<boolean> {
    const record = this.state.offsetRecords.get(offsetId);
    if (!record) {
      return { ok: false, value: this.ERR_INVALID_AMOUNT };
    }
    if (caller !== record.user) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.offsetLicenses.set(`${offsetId}-${licensee}`, {
      expiry: this.mockBlockHeight + duration,
      terms,
      active: true,
    });
    return { ok: true, value: true };
  }

  addOffsetCategory(caller: string, offsetId: number, category: string, tags: string[]): ClarityResponse<boolean> {
    const record = this.state.offsetRecords.get(offsetId);
    if (!record) {
      return { ok: false, value: this.ERR_INVALID_AMOUNT };
    }
    if (caller !== record.user) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.offsetCategories.set(offsetId, { category, tags });
    return { ok: true, value: true };
  }

  addCollaborator(caller: string, offsetId: number, collaborator: string, role: string, permissions: string[]): ClarityResponse<boolean> {
    const record = this.state.offsetRecords.get(offsetId);
    if (!record) {
      return { ok: false, value: this.ERR_INVALID_AMOUNT };
    }
    if (caller !== record.user) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.collaborators.set(`${offsetId}-${collaborator}`, { role, permissions, addedAt: this.mockBlockHeight });
    return { ok: true, value: true };
  }

  setRevenueShare(caller: string, offsetId: number, participant: string, percentage: number): ClarityResponse<boolean> {
    const record = this.state.offsetRecords.get(offsetId);
    if (!record) {
      return { ok: false, value: this.ERR_INVALID_AMOUNT };
    }
    if (caller !== record.user) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (percentage > 100) {
      return { ok: false, value: this.ERR_INVALID_AMOUNT };
    }
    this.state.revenueShares.set(`${offsetId}-${participant}`, { percentage, totalReceived: 0 });
    return { ok: true, value: true };
  }

  transferCct(caller: string, amount: number, recipient: string): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (amount <= 0) {
      return { ok: false, value: this.ERR_INVALID_AMOUNT };
    }
    const senderBalance = this.state.balances.get(caller) ?? 0;
    if (senderBalance < amount) {
      return { ok: false, value: this.ERR_INVALID_AMOUNT };
    }
    this.state.balances.set(caller, senderBalance - amount);
    const recipientBalance = this.state.balances.get(recipient) ?? 0;
    this.state.balances.set(recipient, recipientBalance + amount);
    return { ok: true, value: true };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  offsetter: "wallet_1",
  user1: "wallet_2",
  user2: "wallet_3",
  pool: "pool_contract",
};

describe("OffsetManager Contract", () => {
  let contract: OffsetManagerMock;

  beforeEach(() => {
    contract = new OffsetManagerMock();
    vi.resetAllMocks();
  });

  it("should initialize with correct defaults", () => {
    expect(contract.getContractAdmin()).toEqual({ ok: true, value: "deployer" });
    expect(contract.isPaused()).toEqual({ ok: true, value: false });
    expect(contract.getTotalOffsets()).toEqual({ ok: true, value: 0 });
    expect(contract.getOffsetFee()).toEqual({ ok: true, value: 100 });
    expect(contract.getTotalSupply()).toEqual({ ok: true, value: 0 });
  });

  it("should allow admin to add offsetter", () => {
    const addOffsetter = contract.addOffsetter(accounts.deployer, accounts.offsetter);
    expect(addOffsetter).toEqual({ ok: true, value: true });

    const isOffsetter = contract.isOffsetter(accounts.offsetter);
    expect(isOffsetter).toEqual({ ok: true, value: true });
  });

  it("should prevent non-admin from adding offsetter", () => {
    const addOffsetter = contract.addOffsetter(accounts.user1, accounts.offsetter);
    expect(addOffsetter).toEqual({ ok: false, value: 100 });
  });

  it("should allow offsetter to offset emissions", () => {
    contract.addOffsetter(accounts.deployer, accounts.offsetter);
    
    const offsetResult = contract.offsetEmissions(
      accounts.offsetter,
      500,
      accounts.pool,
      "Offset from wind farm project"
    );
    expect(offsetResult).toEqual({ ok: true, value: 1 });
    expect(contract.getBalance(accounts.offsetter)).toEqual({ ok: true, value: 500 });
    expect(contract.getTotalSupply()).toEqual({ ok: true, value: 500 });
    expect(contract.getTotalOffsets()).toEqual({ ok: true, value: 500 });

    const offsetRecord = contract.getOffsetRecord(1);
    expect(offsetRecord).toEqual({
      ok: true,
      value: expect.objectContaining({
        amount: 500,
        user: accounts.offsetter,
        pool: accounts.pool,
        metadata: "Offset from wind farm project",
        status: "active",
        verified: false,
      }),
    });

    const userOffsets = contract.getUserOffsets(accounts.offsetter);
    expect(userOffsets).toEqual({
      ok: true,
      value: expect.objectContaining({
        totalOffset: 500,
        activeOffset: 500,
        retiredOffset: 0,
      }),
    });
  });

  it("should prevent non-offsetter from offsetting", () => {
    const offsetResult = contract.offsetEmissions(
      accounts.user1,
      500,
      accounts.pool,
      "Unauthorized offset"
    );
    expect(offsetResult).toEqual({ ok: false, value: 104 });
  });

  it("should allow retiring offset", () => {
    contract.addOffsetter(accounts.deployer, accounts.user1);
    contract.offsetEmissions(accounts.user1, 1000, accounts.pool, "Test offset");

    const retireResult = contract.retireOffset(accounts.user1, 1);
    expect(retireResult).toEqual({ ok: true, value: true });
    expect(contract.getBalance(accounts.user1)).toEqual({ ok: true, value: 0 });
    expect(contract.getTotalSupply()).toEqual({ ok: true, value: 0 });

    const offsetRecord = contract.getOffsetRecord(1);
    expect(offsetRecord).toEqual({
      ok: true,
      value: expect.objectContaining({
        status: "retired",
        verified: true,
      }),
    });

    const userOffsets = contract.getUserOffsets(accounts.user1);
    expect(userOffsets).toEqual({
      ok: true,
      value: expect.objectContaining({
        totalOffset: 1000,
        activeOffset: 0,
        retiredOffset: 1000,
      }),
    });
  });

  it("should prevent retiring already retired offset", () => {
    contract.addOffsetter(accounts.deployer, accounts.user1);
    contract.offsetEmissions(accounts.user1, 1000, accounts.pool, "Test offset");
    contract.retireOffset(accounts.user1, 1);

    const retireAgain = contract.retireOffset(accounts.user1, 1);
    expect(retireAgain).toEqual({ ok: false, value: 109 });
  });

  it("should allow admin to verify offset record", () => {
    contract.addOffsetter(accounts.deployer, accounts.user1);
    contract.offsetEmissions(accounts.user1, 1000, accounts.pool, "Test offset");

    const verifyResult = contract.verifyOffsetRecord(accounts.deployer, 1);
    expect(verifyResult).toEqual({ ok: true, value: true });

    const offsetRecord = contract.getOffsetRecord(1);
    expect(offsetRecord).toEqual({
      ok: true,
      value: expect.objectContaining({ verified: true }),
    });
  });

  it("should prevent non-admin from verifying", () => {
    contract.addOffsetter(accounts.deployer, accounts.user1);
    contract.offsetEmissions(accounts.user1, 1000, accounts.pool, "Test offset");

    const verifyResult = contract.verifyOffsetRecord(accounts.user2, 1);
    expect(verifyResult).toEqual({ ok: false, value: 100 });
  });

  it("should allow updating offset version", () => {
    contract.addOffsetter(accounts.deployer, accounts.user1);
    contract.offsetEmissions(accounts.user1, 1000, accounts.pool, "Test offset");

    const updateResult = contract.updateOffsetVersion(accounts.user1, 1, 1, 1200, "Adjusted for new data");
    expect(updateResult).toEqual({ ok: true, value: true });

    const version = contract.getOffsetVersion(1, 1);
    expect(version).toEqual({
      ok: true,
      value: expect.objectContaining({
        updatedAmount: 1200,
        updateNotes: "Adjusted for new data",
      }),
    });
  });

  it("should allow granting offset license", () => {
    contract.addOffsetter(accounts.deployer, accounts.user1);
    contract.offsetEmissions(accounts.user1, 1000, accounts.pool, "Test offset");

    const grantResult = contract.grantOffsetLicense(accounts.user1, 1, accounts.user2, 10000, "License for use in reporting");
    expect(grantResult).toEqual({ ok: true, value: true });
  });

  it("should allow adding offset category", () => {
    contract.addOffsetter(accounts.deployer, accounts.user1);
    contract.offsetEmissions(accounts.user1, 1000, accounts.pool, "Test offset");

    const addCategory = contract.addOffsetCategory(accounts.user1, 1, "renewable-energy", ["solar", "wind"]);
    expect(addCategory).toEqual({ ok: true, value: true });
  });

  it("should allow adding collaborator", () => {
    contract.addOffsetter(accounts.deployer, accounts.user1);
    contract.offsetEmissions(accounts.user1, 1000, accounts.pool, "Test offset");

    const addCollab = contract.addCollaborator(accounts.user1, 1, accounts.user2, "verifier", ["view", "update"]);
    expect(addCollab).toEqual({ ok: true, value: true });
  });

  it("should allow setting revenue share", () => {
    contract.addOffsetter(accounts.deployer, accounts.user1);
    contract.offsetEmissions(accounts.user1, 1000, accounts.pool, "Test offset");

    const setShare = contract.setRevenueShare(accounts.user1, 1, accounts.user2, 20);
    expect(setShare).toEqual({ ok: true, value: true });
  });

  it("should allow CCT transfer", () => {
    contract.addOffsetter(accounts.deployer, accounts.user1);
    contract.offsetEmissions(accounts.user1, 1000, accounts.pool, "Test offset");

    const transferResult = contract.transferCct(accounts.user1, 400, accounts.user2);
    expect(transferResult).toEqual({ ok: true, value: true });
    expect(contract.getBalance(accounts.user1)).toEqual({ ok: true, value: 600 });
    expect(contract.getBalance(accounts.user2)).toEqual({ ok: true, value: 400 });
  });

  it("should prevent transfer during pause", () => {
    contract.addOffsetter(accounts.deployer, accounts.user1);
    contract.offsetEmissions(accounts.user1, 1000, accounts.pool, "Test offset");
    contract.pauseContract(accounts.deployer);

    const transferResult = contract.transferCct(accounts.user1, 400, accounts.user2);
    expect(transferResult).toEqual({ ok: false, value: 101 });
  });

  it("should prevent metadata exceeding max length in offset", () => {
    contract.addOffsetter(accounts.deployer, accounts.offsetter);
    
    const longMetadata = "a".repeat(513);
    const offsetResult = contract.offsetEmissions(
      accounts.offsetter,
      500,
      accounts.pool,
      longMetadata
    );
    expect(offsetResult).toEqual({ ok: false, value: 106 });
  });
});