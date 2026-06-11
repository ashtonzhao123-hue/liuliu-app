import { AddressReviewStatus, OrderStatus, PetReviewStatus, RiskLevel } from '../types';

export function getPetReviewText(status: PetReviewStatus): string {
  return {
    [PetReviewStatus.PendingReview]: '待审核',
    [PetReviewStatus.Approved]: '已通过',
    [PetReviewStatus.Rejected]: '已拒绝'
  }[status];
}

export function getRiskLevelText(level: RiskLevel): string {
  return {
    [RiskLevel.A]: 'A 低风险',
    [RiskLevel.B]: 'B 中低风险',
    [RiskLevel.C]: 'C 中高风险',
    [RiskLevel.D]: 'D 高风险'
  }[level];
}

export function getAddressReviewText(status: AddressReviewStatus): string {
  return status === AddressReviewStatus.Valid ? '服务范围内' : '超出服务区';
}

export function getOrderStatusText(status: OrderStatus): string {
  return {
    [OrderStatus.PendingAccept]: '待接单',
    [OrderStatus.PendingPay]: '待支付',
    [OrderStatus.Accepted]: '已接单',
    [OrderStatus.WalkerArrived]: '服务者已到达',
    [OrderStatus.InService]: '服务中',
    [OrderStatus.PendingOwnerConfirm]: '待确认',
    [OrderStatus.Completed]: '已完成',
    [OrderStatus.Cancelled]: '已取消',
    [OrderStatus.ExceptionHandling]: '异常处理中'
  }[status];
}

export function isLiveOrder(status: OrderStatus): boolean {
  return [OrderStatus.Accepted, OrderStatus.WalkerArrived, OrderStatus.InService].includes(status);
}
