import {
  AddressReviewStatus,
  ComplaintStatus,
  OrderStatus,
  PayStatus,
  PetReviewStatus,
  RiskLevel,
  RoleType,
  UserStatus,
  WalkerAuthStatus,
  WalkerServiceStatus,
  type Complaint,
  type Order,
  type OrderCheckpoint,
  type OrderMedia,
  type OrderTrack,
  type Pet,
  type Review,
  type User,
  type UserAddress,
  type WalkerAuth
} from '../types';

type Row = Record<string, any>;

export function mapUser(row: Row): User {
  return {
    id: String(row.id),
    mobile: row.mobile ?? row.email ?? '',
    nickname: row.nickname ?? row.email ?? '用户',
    avatarUrl: row.avatar_url ?? '',
    gender: row.gender ?? 0,
    roleType: mapRoleType(row.role_type),
    userStatus: row.user_status ?? UserStatus.Normal,
    registerSource: row.register_source ?? 'pwa',
    lastLoginAt: row.last_login_at ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    isDeleted: isDeletedValue(row.is_deleted)
  };
}

export function userToRow(user: Partial<User> & { authId?: string; email?: string }) {
  return stripUndefined({
    auth_id: user.authId,
    mobile: user.mobile,
    nickname: user.nickname,
    avatar_url: user.avatarUrl,
    gender: user.gender,
    role_type: user.roleType,
    user_status: user.userStatus,
    register_source: user.registerSource,
    last_login_at: user.lastLoginAt,
    is_deleted: softDeleteToNumber(user.isDeleted)
  });
}

export function mapPet(row: Row): Pet {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id ?? row.user_id),
    petName: row.pet_name ?? row.name ?? '',
    avatarUrl: row.avatar_url ?? '',
    breed: row.breed ?? '',
    gender: row.gender ?? 1,
    ageMonths: row.age_months ?? 0,
    weightKg: Number(row.weight_kg ?? 0),
    sizeLevel: row.size_level ?? 1,
    neutered: row.neutered ?? 0,
    vaccinated: row.vaccinated ?? 0,
    acceptsStrangers: row.accepts_strangers ?? 0,
    biteHistory: row.bite_history ?? 0,
    jumpPeople: row.jump_people ?? 0,
    leashTrained: row.leash_trained ?? 0,
    healthNote: row.health_note ?? undefined,
    remark: row.remark ?? undefined,
    riskLevel: row.risk_level ?? RiskLevel.A,
    reviewStatus: row.review_status ?? PetReviewStatus.PendingReview,
    rejectReason: row.reject_reason ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    isDeleted: isDeletedValue(row.is_deleted)
  };
}

export function petToRow(pet: Partial<Pet>) {
  return stripUndefined({
    user_id: pet.ownerUserId,
    pet_name: pet.petName,
    avatar_url: pet.avatarUrl,
    breed: pet.breed,
    gender: pet.gender,
    age_months: pet.ageMonths,
    weight_kg: pet.weightKg,
    size_level: pet.sizeLevel,
    neutered: pet.neutered,
    vaccinated: pet.vaccinated,
    accepts_strangers: pet.acceptsStrangers,
    bite_history: pet.biteHistory,
    jump_people: pet.jumpPeople,
    leash_trained: pet.leashTrained,
    health_note: pet.healthNote,
    remark: pet.remark,
    risk_level: pet.riskLevel,
    review_status: pet.reviewStatus,
    reject_reason: pet.rejectReason,
    is_deleted: softDeleteToNumber(pet.isDeleted)
  });
}

export function mapAddress(row: Row): UserAddress {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    communityName: row.community_name ?? '',
    buildingNo: row.building_no ?? '',
    roomNo: row.room_no ?? '',
    contactName: row.contact_name ?? '',
    contactMobile: row.contact_mobile ?? '',
    lat: Number(row.lat ?? 0),
    lng: Number(row.lng ?? 0),
    fullAddress: row.full_address ?? `${row.community_name ?? ''} ${row.building_no ?? ''} ${row.room_no ?? ''}`.trim(),
    addressNote: row.address_note ?? undefined,
    isDefault: row.is_default ?? 0,
    reviewStatus: row.review_status ?? AddressReviewStatus.Valid,
    distanceMeters: Number(row.distance_meters ?? 0),
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    isDeleted: isDeletedValue(row.is_deleted)
  };
}

export function addressToRow(address: Partial<UserAddress>) {
  return stripUndefined({
    user_id: address.userId,
    community_name: address.communityName,
    building_no: address.buildingNo,
    room_no: address.roomNo,
    contact_name: address.contactName,
    contact_mobile: address.contactMobile,
    lat: address.lat,
    lng: address.lng,
    full_address: address.fullAddress,
    address_note: address.addressNote,
    is_default: address.isDefault,
    review_status: address.reviewStatus,
    distance_meters: address.distanceMeters,
    is_deleted: softDeleteToNumber(address.isDeleted)
  });
}

export function mapOrder(row: Row): Order {
  return {
    id: String(row.id),
    orderNo: row.order_no ?? '',
    ownerUserId: String(row.owner_user_id ?? row.owner_id),
    walkerUserId: row.walker_user_id ?? row.walker_id ? String(row.walker_user_id ?? row.walker_id) : undefined,
    petId: String(row.pet_id),
    addressId: String(row.address_id),
    serviceType: row.service_type ?? 1,
    serviceDurationMinutes: row.service_duration_minutes ?? 30,
    appointmentTime: row.appointment_time ?? new Date().toISOString(),
    orderStatus: row.order_status ?? OrderStatus.PendingAccept,
    specialRequirements: row.special_requirements ?? undefined,
    amountTotal: Number(row.amount_total ?? 0),
    platformCommission: Number(row.platform_commission ?? 0),
    walkerIncome: Number(row.walker_income ?? 0),
    payStatus: row.pay_status ?? PayStatus.Pending,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    completedAt: row.completed_at ?? undefined,
    cancelReason: row.cancel_reason ?? undefined,
    cancelByUserId: row.cancel_by_user_id ? String(row.cancel_by_user_id) : undefined,
    exceptionFlag: row.exception_flag ?? 0,
    petNameSnapshot: row.pet_name_snapshot ?? '',
    breedSnapshot: row.breed_snapshot ?? '',
    ownerNicknameSnapshot: row.owner_nickname_snapshot ?? '',
    walkerNicknameSnapshot: row.walker_nickname_snapshot ?? undefined,
    addressSnapshot: row.address_snapshot ?? '',
    reportPhotos: Array.isArray(row.report_photos) ? row.report_photos : [],
    hasPoop: row.has_poop ?? undefined,
    hasPee: row.has_pee ?? undefined,
    walkerNote: row.walker_note ?? undefined,
    walkDistance: row.walk_distance === null || row.walk_distance === undefined ? undefined : Number(row.walk_distance),
    walkDuration: row.walk_duration === null || row.walk_duration === undefined ? undefined : Number(row.walk_duration),
    reportSubmittedAt: row.report_submitted_at ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString()
  };
}

export function orderToRow(order: Partial<Order>) {
  return stripUndefined({
    order_no: order.orderNo,
    owner_id: order.ownerUserId,
    walker_id: order.walkerUserId,
    pet_id: order.petId,
    address_id: order.addressId,
    service_type: order.serviceType,
    service_duration_minutes: order.serviceDurationMinutes,
    appointment_time: order.appointmentTime,
    order_status: order.orderStatus,
    special_requirements: order.specialRequirements,
    amount_total: order.amountTotal,
    platform_commission: order.platformCommission,
    walker_income: order.walkerIncome,
    pay_status: order.payStatus,
    start_time: order.startTime,
    end_time: order.endTime,
    completed_at: order.completedAt,
    cancel_reason: order.cancelReason,
    cancel_by_user_id: order.cancelByUserId,
    exception_flag: order.exceptionFlag,
    pet_name_snapshot: order.petNameSnapshot,
    breed_snapshot: order.breedSnapshot,
    owner_nickname_snapshot: order.ownerNicknameSnapshot,
    walker_nickname_snapshot: order.walkerNicknameSnapshot,
    address_snapshot: order.addressSnapshot,
    report_photos: order.reportPhotos,
    has_poop: order.hasPoop,
    has_pee: order.hasPee,
    walker_note: order.walkerNote,
    walk_distance: order.walkDistance,
    walk_duration: order.walkDuration,
    report_submitted_at: order.reportSubmittedAt
  });
}

export function mapTrack(row: Row): OrderTrack {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    walkerUserId: String(row.walker_user_id),
    lat: Number(row.lat ?? 0),
    lng: Number(row.lng ?? 0),
    accuracy: Number(row.accuracy ?? 0),
    speed: Number(row.speed ?? 0),
    direction: Number(row.direction ?? 0),
    recordedAt: row.recorded_at ?? row.created_at ?? new Date().toISOString(),
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

export function trackToRow(track: Partial<OrderTrack>) {
  return stripUndefined({
    order_id: track.orderId,
    walker_user_id: track.walkerUserId,
    lat: track.lat,
    lng: track.lng,
    accuracy: track.accuracy,
    speed: track.speed,
    direction: track.direction,
    recorded_at: track.recordedAt
  });
}

export function mapCheckpoint(row: Row): OrderCheckpoint {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    walkerUserId: String(row.walker_user_id),
    checkpointType: row.checkpoint_type,
    lat: Number(row.lat ?? 0),
    lng: Number(row.lng ?? 0),
    photoUrl: row.photo_url ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

export function checkpointToRow(checkpoint: Partial<OrderCheckpoint>) {
  return stripUndefined({
    order_id: checkpoint.orderId,
    walker_user_id: checkpoint.walkerUserId,
    checkpoint_type: checkpoint.checkpointType,
    lat: checkpoint.lat,
    lng: checkpoint.lng,
    photo_url: checkpoint.photoUrl,
    note: checkpoint.note
  });
}

export function mapMedia(row: Row): OrderMedia {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    uploaderUserId: String(row.uploader_user_id),
    mediaType: row.media_type ?? 1,
    mediaScene: row.media_scene ?? 2,
    mediaUrl: row.media_url ?? '',
    thumbnailUrl: row.thumbnail_url ?? row.media_url ?? '',
    remark: row.remark ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

export function mediaToRow(media: Partial<OrderMedia>) {
  return stripUndefined({
    order_id: media.orderId,
    uploader_user_id: media.uploaderUserId,
    media_type: media.mediaType,
    media_scene: media.mediaScene,
    media_url: media.mediaUrl,
    thumbnail_url: media.thumbnailUrl,
    remark: media.remark
  });
}

export function mapReview(row: Row): Review {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    fromUserId: String(row.from_user_id),
    toUserId: String(row.to_user_id),
    rating: row.rating ?? 5,
    punctualScore: row.punctual_score ?? 5,
    attitudeScore: row.attitude_score ?? 5,
    petFriendlyScore: row.pet_friendly_score ?? 5,
    requirementScore: row.requirement_score ?? 5,
    content: row.content ?? '',
    isRevealed: row.is_revealed ?? false,
    revealedAt: row.revealed_at ?? undefined,
    dimensionTags: Array.isArray(row.dimension_tags) ? row.dimension_tags : [],
    privateNote: row.private_note ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

export function reviewToRow(review: Partial<Review>) {
  return stripUndefined({
    order_id: review.orderId,
    from_user_id: review.fromUserId,
    to_user_id: review.toUserId,
    rating: review.rating,
    punctual_score: review.punctualScore,
    attitude_score: review.attitudeScore,
    pet_friendly_score: review.petFriendlyScore,
    requirement_score: review.requirementScore,
    content: review.content,
    is_revealed: review.isRevealed,
    revealed_at: review.revealedAt,
    dimension_tags: review.dimensionTags,
    private_note: review.privateNote
  });
}

export function mapComplaint(row: Row): Complaint {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    userId: String(row.complainant_user_id ?? row.user_id),
    complaintType: row.complaint_type ?? 'other',
    content: row.content ?? '',
    evidenceUrls: Array.isArray(row.evidence_urls) ? row.evidence_urls : [],
    status: row.complaint_status ?? row.status ?? ComplaintStatus.Pending,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

export function complaintToRow(complaint: Partial<Complaint> & { targetUserId?: string }) {
  return stripUndefined({
    order_id: complaint.orderId,
    complainant_user_id: complaint.userId,
    user_id: complaint.userId,
    target_user_id: complaint.targetUserId,
    complaint_type: complaint.complaintType,
    content: complaint.content,
    evidence_urls: complaint.evidenceUrls,
    complaint_status: complaint.status
  });
}

export function mapWalkerAuth(row: Row): WalkerAuth {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    schoolName: row.school_name ?? '',
    studentNo: row.student_no ?? undefined,
    campusEmail: row.campus_email ?? undefined,
    studentCardUrl: row.student_card_url ?? '',
    studentCardHoldUrl: row.student_card_hold_url ?? '',
    livingAreaText: row.living_area_text ?? '',
    serviceRadiusKm: Number(row.service_radius_km ?? 3),
    walkerAuthStatus: row.walker_auth_status ?? WalkerAuthStatus.PendingReview,
    rejectReason: row.reject_reason ?? undefined,
    examStatus: row.exam_status ?? 1,
    examScore: row.exam_score ?? undefined,
    walkerLevel: row.walker_level ?? 1,
    walkerServiceStatus: row.walker_service_status ?? WalkerServiceStatus.Available,
    approvedAt: row.approved_at ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString()
  };
}

export function stripUndefined<T extends Record<string, any>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function isDeletedValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function softDeleteToNumber(value: boolean | undefined): 0 | 1 | undefined {
  if (value === undefined) return undefined;
  return value ? 1 : 0;
}

function mapRoleType(value: unknown): RoleType | undefined {
  const roleType = Number(value);
  if (roleType === RoleType.Owner || roleType === RoleType.Walker || roleType === RoleType.Dual) {
    return roleType;
  }
  return undefined;
}
