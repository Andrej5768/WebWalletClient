import { Injectable } from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Account} from "../models/account";
import {catchError, Observable, retry, throwError} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class AccountService {

  // Base url
  baseurl = 'http://localhost:8080';
  constructor(private http: HttpClient) {}
  // Http Headers
  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
    }),
  };

  // POST
  CreateAccount(data: any): Observable<Account> {
    return this.http
      .post<Account>(
        this.baseurl + '/bugtracking/',
        JSON.stringify(data),
        this.httpOptions
      )
      .pipe(retry(1), catchError(this.errorHandl));
  }
  // GET
  GetAccount(id: string): Observable<Account> {
    return this.http
      .get<Account>(this.baseurl + '/bugtracking/' + id)
      .pipe(retry(1), catchError(this.errorHandl));
  }
  // GET
  GetAccounts(): Observable<Account> {
    return this.http
      .get<Account>(this.baseurl + '/bugtracking/')
      .pipe(retry(1), catchError(this.errorHandl));
  }
  // PUT
  UpdateAccount(id: string, data: any): Observable<Account> {
    return this.http
      .put<Account>(
        this.baseurl + '/bugtracking/' + id,
        JSON.stringify(data),
        this.httpOptions
      )
      .pipe(retry(1), catchError(this.errorHandl));
  }
  // DELETE
  DeleteAccount(id: string) {
    return this.http
      .delete<Account>(this.baseurl + '/bugtracking/' + id, this.httpOptions)
      .pipe(retry(1), catchError(this.errorHandl));
  }
  // Error handling
  errorHandl(error: { error: { message: string; }; status: any; message: any; }) {
    let errorMessage = '';
    if (error.error instanceof ErrorEvent) {
      // Get client-side error
      errorMessage = error.error.message;
    } else {
      // Get server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.log(errorMessage);
    return throwError(() => {
      return errorMessage;
    });
  }
}
