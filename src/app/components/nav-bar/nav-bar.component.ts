import { Component } from '@angular/core';
import {StorageService} from "../../_services/storage.service";
import {AuthService} from "../../_services/auth.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-nav-bar',
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.css']
})
export class NavBarComponent {
  isLoggedIn = false;
  errorMessage = '';
  roles: string[] = [];

  constructor(private storageService: StorageService, private authService: AuthService, private router: Router) {
  }

  ngOnInit(): void {
    if (this.storageService.isLoggedIn()) {
      this.router.events.subscribe(() => {
          this.isLoggedIn = this.storageService.isLoggedIn();
          this.roles = this.storageService.getUser().roles;
      })
    }
  }
}
