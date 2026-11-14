import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

const APP_NAME = 'LinkPulse';

@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pageName = this.buildTitle(snapshot);
    this.title.setTitle(pageName ? `${APP_NAME} | ${pageName}` : APP_NAME);
  }
}
