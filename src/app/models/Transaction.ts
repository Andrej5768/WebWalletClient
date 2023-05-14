import {Category} from "./category";

export interface Transaction {
  id : bigint
  categoryDto : Category
  type : TransactionType
  amount : number
  date : string
  description : string
  sourceAccountId : bigint
  destinationAccountId? : bigint
}

export enum TransactionType {
  TRANSFER,
  INCOME,
  EXPENSE
}
