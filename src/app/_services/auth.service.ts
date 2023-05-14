import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from "../../environments/environment";
import {Router} from "@angular/router";
import {StorageService} from "./storage.service";

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient,
              private router: Router, private storageService: StorageService) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post(
      `${environment.apiUrl}/auth/signin`,
      {
        email,
        password,
      },
      httpOptions
    );
  }

  register(firstName: string, lastName: string, email: string, password: string): Observable<any> {
    return this.http.post(
      `${environment.apiUrl}/auth/register`,
      {
        firstName,
        lastName,
        email,
        password,
      },
      httpOptions
    );
  }

  logout(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/logout`, { }, httpOptions);
  }

  refreshToken(token: string) {
    return this.http.post(`${environment.apiUrl}/auth/refreshtoken`, {
      refreshToken: token
    }, httpOptions);
  }
}
