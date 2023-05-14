import {Account} from "./account";
import {Category} from "./category";
import {Transaction} from "./Transaction";

export interface Wallet {
  id: bigint
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  balance: bigint

}

