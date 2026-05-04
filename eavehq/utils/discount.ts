/**
 * Returns the discounted total price, or the original total if no discount is set.
 * - 'percent': reduces total by discountAmount percent (e.g. 10 = 10% off)
 * - 'flat':    reduces total by a flat dollar amount
 */
export function calcDiscountedPrice(
	total: number,
	discountAmount: number | null,
	discountType: string | null
): number {
	if (discountAmount == null || discountType == null) return total;
	if (discountType === 'percent') {
		return total * (1 - discountAmount / 100);
	}
	if (discountType === 'flat') {
		return Math.max(0, total - discountAmount);
	}
	return total;
}

/**
 * Returns a human-readable savings label, e.g. "10% off" or "Save $50.00".
 */
export function discountLabel(
	discountAmount: number,
	discountType: string,
	total: number
): string {
	if (discountType === 'percent') {
		return `${discountAmount}% off`;
	}
	const saving = Math.min(discountAmount, total);
	return `Save $${saving.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
