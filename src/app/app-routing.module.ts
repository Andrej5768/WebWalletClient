import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {LoginComponent} from "./components/login/login.component";
import {RegisterComponent} from "./components/register/register.component";
import {HomeComponent} from "./components/home/home.component";
import {WalletComponent} from "./components/wallet/wallet.component";
import {LogoutComponent} from "./components/logout/logout.component";


const routes: Routes = [
  {
    path: 'home',
    component: HomeComponent,
    title: "WebWallet"
  },
  {
    path: 'login',
    component: LoginComponent,
    title: "Login"
  },
  {
    path: 'registration',
    component: RegisterComponent,
    title: "Registration"
  },
  {
    path: 'wallet',
    component: WalletComponent,
    title: "WebWallet"
  },
  {
    path: 'accounts',
    component: WalletComponent,
    title: "Accounts"
  },
  {
    path: 'transactions',
    component: WalletComponent,
    title: "Transactions"
  },
  {
    path: 'categories',
    component: WalletComponent,
    title: "Categories"
  },
  {
    path: 'logout',
    component: LogoutComponent,
    title: "logout"
  },

  { path: '**', component: HomeComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
