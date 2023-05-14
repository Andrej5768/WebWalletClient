export interface Category {
  id: bigint
  name: string
  categoryType: CategoryType
  walletId: bigint
}

export enum CategoryType {
  EXPENSE,
  INCOME
}
