import { Injectable } from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Router} from "@angular/router";
import {Observable} from "rxjs";
import {environment} from "../../environments/environment";
import {StorageService} from "./storage.service";
import {Wallet} from "../models/wallet";
import {Account} from "../models/account";

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};

@Injectable({
  providedIn: 'root'
})
export class WalletService {

  constructor(private http: HttpClient,
              private router: Router,
              private storageService: StorageService) {}

  getWallet(): any{
    return this.http.get(
      `${environment.apiUrl}/wallet/1`,
      {
        headers: new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.storageService.getToken() }
        )}
    )

  }
}
