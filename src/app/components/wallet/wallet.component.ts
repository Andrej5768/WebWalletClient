import { Component } from '@angular/core';
import {AuthService} from "../../_services/auth.service";
import {StorageService} from "../../_services/storage.service";
import {Router} from "@angular/router";
import {WalletService} from "../../_services/wallet.service";
import {Wallet} from "../../models/wallet";
import {Account} from "../../models/account";
import {Transaction} from "../../models/Transaction";
import {TransactionService} from "../../_services/transaction.service";

@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.css']
})
export class WalletComponent {
  clik = false
  wallet!: Wallet;

  constructor(private walletService: WalletService,
              private transactionService: TransactionService) {
  }

  ngOnInit(): void {
    this.walletService.getWallet().subscribe((data: any) => {
      this.wallet = {
        id: BigInt(data.id),
        accounts: data.accounts.map((account: any) => ({
          id: BigInt(account.id),
          name: account.name,
          balance: BigInt(account.balance), // Преобразование из десятичной валюты в целочисленную
          type: account.type,
        })),
        categories: data.categories.map((category: any) => ({
          id: BigInt(category.id),
          name: category.name,
          type: category.type,
        })),
        transactions: data.transactions.map((transaction: any) => ({
          id: BigInt(transaction.id),
          type: transaction.type,
          categoryDto: {
            id: BigInt(transaction.categoryDto.id),
            name: transaction.categoryDto.name,
            type: transaction.categoryDto.type,
          },
          amount: BigInt(transaction.amount), // Преобразование из десятичной валюты в целочисленную
          date: new Date(transaction.date),
          description: transaction.description,
          sourceAccountId: BigInt(transaction.sourceAccountId),
          destinationAccountId: transaction.destinationAccountId
            ? BigInt(transaction.destinationAccountId)
            : null,
        })),
        balance: BigInt(data.balance * 100), // Преобразование из десятичной валюты в целочисленную
      };
    });

    // this.wallet = JSON.parse(this.walletService.getWallet());
    // this.walletService.getWallet().subscribe(accounts =>
    // this.accounts = accounts)
    // this.transactionService.getAll().subscribe(transactions =>
    // this.transactions = transactions)
    // console.log("JSON object -", this.wallet)
    // console.log("JSON object 2 -", this.walletService.getWallet())
  }

  getWallet(): void {
  }
}
