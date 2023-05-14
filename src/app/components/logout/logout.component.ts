import { Component } from '@angular/core';
import {AuthService} from "../../_services/auth.service";
import {StorageService} from "../../_services/storage.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-logout',
  templateUrl: './logout.component.html',
  styleUrls: ['./logout.component.css']
})
export class LogoutComponent {
    constructor(private authService: AuthService, private storageService: StorageService, private router: Router) {
    }

    ngOnInit() {
      // this.authService.logout();
      this.storageService.clean();
      this.router.navigate(["/home"]);
    }
}
