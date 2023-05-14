import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { HomeComponent } from './components/home/home.component';
import { NavBarComponent } from './components/nav-bar/nav-bar.component';
import {AccountService} from "./_services/account.service";
import { RegisterComponent } from './components/register/register.component';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {HttpClient, HttpClientModule} from "@angular/common/http";
import {BoardModeratorComponent} from "./board-moderator/board-moderator.component";
import {BoardAdminComponent} from "./board-admin/board-admin.component";
import {BoardUserComponent} from "./board-user/board-user.component";
import {ProfileComponent} from "./profile/profile.component";
import { WalletComponent } from './components/wallet/wallet.component';
import { LogoutComponent } from './components/logout/logout.component';
import { TransactionComponent } from './components/transaction/transaction.component';
import { AccountComponent } from './components/account/account.component';
import { CategoryComponent } from './components/category/category.component';


@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    HomeComponent,
    NavBarComponent,
    RegisterComponent,
    BoardAdminComponent,
    BoardModeratorComponent,
    BoardUserComponent,
    ProfileComponent,
    WalletComponent,
    LogoutComponent,
    TransactionComponent,
    AccountComponent,
    CategoryComponent

  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    HttpClientModule,
    FormsModule
  ],
  providers: [AccountService],
  bootstrap: [AppComponent]
})
export class AppModule { }
