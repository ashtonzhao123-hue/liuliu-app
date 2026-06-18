export type ID = string;
export type ISODateTime = string;

export interface TimestampFields {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SoftDeleteFields {
  isDeleted: boolean;
}

export enum RoleType {
  Owner = 1,
  Walker = 2,
  Dual = 3
}

export enum UserStatus {
  Normal = 1,
  Frozen = 2,
  Banned = 3
}

export enum AuthStatus {
  PendingSubmit = 0,
  PendingReview = 1,
  Approved = 2,
  Rejected = 3
}

export enum WalkerAuthStatus {
  PendingReview = 1,
  Approved = 2,
  Rejected = 3
}

export enum WalkerServiceStatus {
  Available = 1,
  Paused = 2,
  Disabled = 3
}

export enum PetReviewStatus {
  PendingReview = 1,
  Approved = 2,
  Rejected = 3
}

export enum AddressReviewStatus {
  Valid = 1,
  OutOfServiceArea = 2
}

export enum RiskLevel {
  A = 1,
  B = 2,
  C = 3,
  D = 4
}

export enum OrderStatus {
  PendingAccept = 10,
  PendingPay = 20,
  Accepted = 30,
  WalkerArrived = 40,
  InService = 50,
  PendingOwnerConfirm = 60,
  Completed = 70,
  Cancelled = 80,
  ExceptionHandling = 90
}

export enum PayStatus {
  Pending = 0,
  Success = 1,
  Failed = 2,
  Closed = 3,
  Refunded = 4
}

export enum SettleStatus {
  Pending = 0,
  Settled = 1,
  Frozen = 2
}

export enum WithdrawStatus {
  PendingReview = 0,
  Approved = 1,
  Rejected = 2,
  Paid = 3
}

export enum ComplaintStatus {
  Pending = 0,
  Processing = 1,
  Completed = 2,
  Closed = 3
}

export enum CheckpointType {
  Arrived = 1,
  ServiceStarted = 2,
  Progress = 3,
  ServiceEnded = 4,
  Returned = 5
}

export type Gender = 0 | 1 | 2;
export type PetGender = 1 | 2;
export type BooleanNumber = 0 | 1;
export type PetSizeLevel = 1 | 2 | 3;
export type ServiceType = 1;
export type WalkerExamStatus = 0 | 1 | 2;
export type WalkerLevel = 1 | 2;
export type SelectedRole = 'owner' | 'walker';
export type PetBreedCode = 'BICHON' | 'POODLE' | 'POMERANIAN' | 'SCHNAUZER' | 'CHIHUAHUA' | 'YORKSHIRE' | 'CORGI';
export type OwnerOrderFilter = 'all' | 'pendingAccept' | 'pendingPay' | 'inProgress' | 'pendingConfirm' | 'completed' | 'cancelled';
export type MediaType = 1 | 2;
export type MediaScene = 1 | 2 | 3;
export type ComplaintType = 'lost_contact' | 'service_exception' | 'pet_exception' | 'fee_dispute' | 'other';

export interface AuthToken {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: ISODateTime;
}

export interface LoginResponse {
  token: AuthToken;
  user: User;
  hasSelectedRole: boolean;
  selectedRole?: SelectedRole;
}

export interface User extends TimestampFields, SoftDeleteFields {
  id: ID;
  mobile: string;
  nickname: string;
  avatarUrl: string;
  gender: Gender;
  roleType?: RoleType;
  userStatus: UserStatus;
  registerSource: string;
  lastLoginAt?: ISODateTime;
}

export interface UserRealAuth extends TimestampFields {
  id: ID;
  userId: ID;
  realName: string;
  idCardNo: string;
  idCardFrontUrl: string;
  idCardBackUrl: string;
  faceVerifyStatus: WalkerExamStatus;
  authStatus: AuthStatus;
  rejectReason?: string;
  submittedAt?: ISODateTime;
  reviewedAt?: ISODateTime;
}

export interface WalkerAuth extends TimestampFields {
  id: ID;
  userId: ID;
  schoolName: string;
  studentNo?: string;
  campusEmail?: string;
  studentCardUrl: string;
  studentCardHoldUrl: string;
  livingAreaText: string;
  serviceRadiusKm: number;
  walkerAuthStatus: WalkerAuthStatus;
  rejectReason?: string;
  examStatus: WalkerExamStatus;
  examScore?: number;
  walkerLevel: WalkerLevel;
  walkerServiceStatus: WalkerServiceStatus;
  approvedAt?: ISODateTime;
}

export interface Pet extends TimestampFields, SoftDeleteFields {
  id: ID;
  ownerUserId: ID;
  petName: string;
  avatarUrl: string;
  breed: string;
  gender: PetGender;
  ageMonths: number;
  weightKg: number;
  sizeLevel: PetSizeLevel;
  neutered: BooleanNumber;
  vaccinated: BooleanNumber;
  acceptsStrangers: BooleanNumber;
  biteHistory: BooleanNumber;
  jumpPeople: BooleanNumber;
  leashTrained: BooleanNumber;
  healthNote?: string;
  remark?: string;
  riskLevel: RiskLevel;
  reviewStatus: PetReviewStatus;
  rejectReason?: string;
}

export interface UserAddress extends TimestampFields, SoftDeleteFields {
  id: ID;
  userId: ID;
  communityName: string;
  buildingNo: string;
  roomNo: string;
  contactName: string;
  contactMobile: string;
  lat: number;
  lng: number;
  fullAddress: string;
  addressNote?: string;
  isDefault: BooleanNumber;
  reviewStatus: AddressReviewStatus;
  distanceMeters: number;
}

export interface Order extends TimestampFields {
  id: ID;
  orderNo: string;
  ownerUserId: ID;
  walkerUserId?: ID;
  petId: ID;
  addressId: ID;
  serviceType: ServiceType;
  serviceDurationMinutes: number;
  appointmentTime: ISODateTime;
  orderStatus: OrderStatus;
  specialRequirements?: string;
  amountTotal: number;
  platformCommission: number;
  walkerIncome: number;
  payStatus: PayStatus;
  startTime?: ISODateTime;
  endTime?: ISODateTime;
  completedAt?: ISODateTime;
  cancelReason?: string;
  cancelByUserId?: ID;
  exceptionFlag: BooleanNumber;
  petNameSnapshot: string;
  breedSnapshot: string;
  ownerNicknameSnapshot: string;
  walkerNicknameSnapshot?: string;
  addressSnapshot: string;
  reportPhotos?: string[];
  hasPoop?: boolean;
  hasPee?: boolean;
  walkerNote?: string;
  walkDistance?: number;
  walkDuration?: number;
  reportSubmittedAt?: ISODateTime;
}

export interface OrderCheckpoint {
  id: ID;
  orderId: ID;
  walkerUserId: ID;
  checkpointType: CheckpointType;
  lat: number;
  lng: number;
  photoUrl?: string;
  note?: string;
  createdAt: ISODateTime;
}

export interface OrderTrack {
  id: ID;
  orderId: ID;
  walkerUserId: ID;
  lat: number;
  lng: number;
  accuracy: number;
  speed: number;
  direction: number;
  recordedAt: ISODateTime;
  createdAt: ISODateTime;
}

export interface OrderMedia {
  id: ID;
  orderId: ID;
  uploaderUserId: ID;
  mediaType: MediaType;
  mediaScene: MediaScene;
  mediaUrl: string;
  thumbnailUrl: string;
  remark?: string;
  createdAt: ISODateTime;
}

export interface Payment {
  id: ID;
  orderId: ID;
  payNo: string;
  payerUserId: ID;
  payChannel: string;
  payAmount: number;
  payStatus: PayStatus;
  thirdTradeNo?: string;
  paidAt?: ISODateTime;
  createdAt: ISODateTime;
}

export interface Review {
  id: ID;
  orderId: ID;
  fromUserId: ID;
  toUserId: ID;
  rating: number;
  punctualScore: number;
  attitudeScore: number;
  petFriendlyScore: number;
  requirementScore: number;
  content: string;
  isRevealed?: boolean;
  revealedAt?: ISODateTime;
  dimensionTags?: string[];
  privateNote?: string;
  createdAt: ISODateTime;
}

export interface Complaint {
  id: ID;
  orderId: ID;
  userId: ID;
  complaintType: ComplaintType;
  content: string;
  evidenceUrls: string[];
  status: ComplaintStatus;
  createdAt: ISODateTime;
}
