export interface Account {
  id : number
  name : string
  balance : number
  type : string
}

export enum AccountType {
  CASH,
  BANK_CARD,
  DEPOSIT,
  CREDIT_CARD
}
