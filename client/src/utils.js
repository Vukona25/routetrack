export const STATUS_LABELS = {
  pending: 'Pending',
  in_transit: 'In transit',
  delivered: 'Delivered',
};

export const NEXT_ACTION = {
  pending: { status: 'in_transit', label: 'Start trip' },
  in_transit: { status: 'delivered', label: 'Mark delivered' },
};

export function formatDate(value) {
  return new Date(value).toLocaleString('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
