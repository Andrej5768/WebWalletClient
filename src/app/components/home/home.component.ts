import { Component } from '@angular/core';
import {StorageService} from "../../_services/storage.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
    constructor(private storageService: StorageService, private router: Router ) {
    }

  ngOnInit(): void {
    if (this.storageService.isLoggedIn()) {
      this.router.navigate(["/wallet"]);
    }
  }
}
