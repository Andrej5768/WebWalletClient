import { Injectable } from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Router} from "@angular/router";
import {StorageService} from "./storage.service";
import {Observable} from "rxjs";
import {Account} from "../models/account";
import {environment} from "../../environments/environment";
import {Transaction} from "../models/Transaction";

@Injectable({
  providedIn: 'root'
})
export class TransactionService {

  constructor(private http: HttpClient,
              private router: Router,
              private storageService: StorageService) {}

  getAll(): Observable<Transaction[]>{
    return this.http.get<Transaction[]>(
      `${environment.apiUrl}/wallet/1/transactions`,
      {
        headers: new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.storageService.getToken() }
        )}
    )

  }
}
