import { OrderStatus } from '../types';

const steps = [
  { status: OrderStatus.PendingAccept, label: '待接单' },
  { status: OrderStatus.PendingPay, label: '已接单' },
  { status: OrderStatus.WalkerArrived, label: '已到达' },
  { status: OrderStatus.InService, label: '服务中' },
  { status: OrderStatus.Completed, label: '已完成' }
];

function getStepIndex(status: OrderStatus): number {
  if (status === OrderStatus.Accepted) return 1;
  if (status === OrderStatus.PendingOwnerConfirm) return 3;
  if (status === OrderStatus.Cancelled || status === OrderStatus.ExceptionHandling) return -1;
  return steps.findIndex((step) => step.status === status);
}

export function OrderStatusSteps({ status }: { status: OrderStatus }) {
  const activeIndex = getStepIndex(status);
  const isStopped = activeIndex < 0;

  return (
    <div className={`order-steps ${isStopped ? 'order-steps--stopped' : ''}`} aria-label="订单进度">
      {steps.map((step, index) => {
        const reached = !isStopped && index <= activeIndex;
        const current = !isStopped && index === activeIndex;
        return (
          <div className={`order-step ${reached ? 'order-step--reached' : ''} ${current ? 'order-step--current' : ''}`} key={step.status}>
            <span className="order-step__dot" />
            <span className="order-step__label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
