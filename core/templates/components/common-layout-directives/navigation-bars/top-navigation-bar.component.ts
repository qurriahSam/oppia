// Copyright 2021 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS O = null KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Component for the top navigation bar. This excludes the part
 * of the navbar that is used for local navigation (such as the various tabs in
 * the editor pages).
 */

import {Subscription} from 'rxjs';
import {ContextService} from 'services/context.service';
import {
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {SidebarStatusService} from 'services/sidebar-status.service';
import {UrlInterpolationService} from 'domain/utilities/url-interpolation.service';
import {SiteAnalyticsService} from 'services/site-analytics.service';
import {UserService} from 'services/user.service';
import {DeviceInfoService} from 'services/contextual/device-info.service';
import debounce from 'lodash/debounce';
import {AlertsService} from 'services/alerts.service';
import {WindowDimensionsService} from 'services/contextual/window-dimensions.service';
import {SearchService} from 'services/search.service';
import {EventToCodes, NavigationService} from 'services/navigation.service';
import {AppConstants} from 'app.constants';
import {NavbarAndFooterGATrackingPages} from 'app.constants';
import {I18nLanguageCodeService} from 'services/i18n-language-code.service';
import {WindowRef} from 'services/contextual/window-ref.service';
import {FocusManagerService} from 'services/stateful/focus-manager.service';
import {I18nService} from 'i18n/i18n.service';
import {CreatorTopicSummary} from 'domain/topic/creator-topic-summary.model';
import {UrlService} from 'services/contextual/url.service';
import {PlatformFeatureService} from 'services/platform-feature.service';
import {LearnerGroupBackendApiService} from 'domain/learner_group/learner-group-backend-api.service';
import {FeedbackUpdatesBackendApiService} from 'domain/feedback_updates/feedback-updates-backend-api.service';
import {FeedbackThreadSummaryBackendDict} from 'domain/feedback_thread/feedback-thread-summary.model';
import {LanguageBannerService} from 'components/language-banner/language-banner.service';

import './top-navigation-bar.component.css';

interface LanguageInfo {
  id: string;
  text: string;
  direction: string;
}
@Component({
  selector: 'oppia-top-navigation-bar',
  templateUrl: './top-navigation-bar.component.html',
  styleUrls: ['./top-navigation-bar.component.css'],
})
export class TopNavigationBarComponent implements OnInit, OnDestroy {
  // These properties are initialized using Angular lifecycle hooks
  // and we need to do non-null assertion. For more information, see
  // https://github.com/oppia/oppia/wiki/Guide-on-defining-types#ts-7-1
  @Input() headerText!: string;
  @Input() subheaderText!: string;

  impactReports = [
    {
      link: AppConstants.IMPACT_REPORT_LINK_2023,
      year: '2023',
    },
    {
      link: AppConstants.IMPACT_REPORT_LINK_2022,
      year: '2022',
    },
  ];
  PAGES_WITH_BACK_STATE: string[] = ['/blog/'];
  menuIconIsShown: boolean = false;
  url!: URL;
  currentLanguageCode!: string;
  supportedSiteLanguages!: LanguageInfo[];
  currentLanguageText!: string;
  classroomData: CreatorTopicSummary[] = [];
  topicTitlesTranslationKeys: string[] = [];
  learnDropdownOffset: number = 0;
  isModerator: boolean = false;
  isCurriculumAdmin: boolean = false;
  isTopicManager: boolean = false;
  pageIsIframed: boolean = false;
  isSuperAdmin: boolean = false;
  isBlogAdmin: boolean = false;
  isBlogPostEditor: boolean = false;
  userIsLoggedIn: boolean = false;
  currentUrl!: string;
  userMenuIsShown: boolean = false;
  inClassroomPage: boolean = false;
  showLanguageSelector: boolean = false;
  standardNavIsShown: boolean = false;
  getInvolvedMenuOffset: number = 0;
  donateMenuOffset: number = 0;
  ACTION_OPEN!: string;
  ACTION_CLOSE!: string;
  KEYBOARD_EVENT_TO_KEY_CODES!: {
    enter: {
      shiftKeyIsPressed: boolean;
      keyCode: number;
    };
    tab: {
      shiftKeyIsPressed: boolean;
      keyCode: number;
    };
    shiftTab: {
      shiftKeyIsPressed: boolean;
      keyCode: number;
    };
  };

  labelForClearingFocus!: string;
  sidebarIsShown: boolean = false;
  windowIsNarrow: boolean = false;
  profilePicturePngDataUrl!: string;
  profilePictureWebpDataUrl!: string;
  unreadThreadsCount: number = 0;
  paginatedThreadsList: FeedbackThreadSummaryBackendDict[][] = [];

  // The 'username', 'profilePageUrl' properties
  // are set using the asynchronous method getUserInfoAsync()
  // which sends a HTTP request to the backend.
  // Until the response object is received and the method returns,
  // these properties remain undefined.
  username: string | undefined;
  profilePageUrl: string | undefined;

  // The 'activeMenuName' property is not initialized in the constructor
  // or in a lifecycle hook, and is set based on certain
  // optional user input (see the onMenuKeypress() method further below).
  // Until that input is received the property remains undefined.
  activeMenuName: string | undefined;

  directiveSubscriptions = new Subscription();
  NAV_MODE_SIGNUP = 'signup';
  NAV_MODES_WITH_CUSTOM_LOCAL_NAV = [
    'create',
    'explore',
    'lesson',
    'collection',
    'collection_editor',
    'topics_and_skills_dashboard',
    'topic_editor',
    'skill_editor',
    'story_editor',
    'blog-dashboard',
  ];

  currentWindowWidth = this.windowDimensionsService.getWidth();
  // The order of the elements in this array specifies the order in
  // which they will be hidden. Earlier elements will be hidden first.
  NAV_ELEMENTS_ORDER = [
    'I18N_TOPNAV_DONATE',
    'I18N_TOPNAV_LEARN',
    'I18N_TOPNAV_ABOUT',
    'I18N_TOPNAV_LIBRARY',
    'I18N_TOPNAV_HOME',
  ];

  LEARNER_GROUPS_FEATURE_IS_ENABLED = false;
  FEEDBACK_UPDATES_IN_PROFILE_PIC_DROP_DOWN_IS_ENABLED = false;
  googleSignInIconUrl = this.urlInterpolationService.getStaticImageUrl(
    '/google_signin_buttons/google_signin.svg'
  );

  navElementsVisibilityStatus: Record<string, boolean> = {};
  PAGES_REGISTERED_WITH_FRONTEND = AppConstants.PAGES_REGISTERED_WITH_FRONTEND;

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private contextService: ContextService,
    private i18nLanguageCodeService: I18nLanguageCodeService,
    private i18nService: I18nService,
    private alertsService: AlertsService,
    private feedbackUpdatesBackendApiService: FeedbackUpdatesBackendApiService,
    private sidebarStatusService: SidebarStatusService,
    private urlInterpolationService: UrlInterpolationService,
    private navigationService: NavigationService,
    private siteAnalyticsService: SiteAnalyticsService,
    private userService: UserService,
    private deviceInfoService: DeviceInfoService,
    private windowDimensionsService: WindowDimensionsService,
    private searchService: SearchService,
    private windowRef: WindowRef,
    private urlService: UrlService,
    private focusManagerService: FocusManagerService,
    private platformFeatureService: PlatformFeatureService,
    private learnerGroupBackendApiService: LearnerGroupBackendApiService,
    private languageBannerService: LanguageBannerService
  ) {}

  ngOnInit(): void {
    this.currentUrl =
      this.windowRef.nativeWindow.location.pathname.split('/')[1];
    this.url = new URL(this.windowRef.nativeWindow.location.toString());
    this.labelForClearingFocus = AppConstants.LABEL_FOR_CLEARING_FOCUS;
    this.focusManagerService.setFocus(this.labelForClearingFocus);
    this.userMenuIsShown = this.currentUrl !== this.NAV_MODE_SIGNUP;
    this.inClassroomPage = false;
    this.pageIsIframed = this.urlService.isIframed();
    this.supportedSiteLanguages = AppConstants.SUPPORTED_SITE_LANGUAGES.map(
      (languageInfo: LanguageInfo) => {
        return languageInfo;
      }
    );
    this.showLanguageSelector = !this.contextService
      .getPageContext()
      .endsWith('editor');

    this.standardNavIsShown =
      this.NAV_MODES_WITH_CUSTOM_LOCAL_NAV.indexOf(this.currentUrl) === -1;
    if (this.currentUrl === 'learn') {
      this.inClassroomPage = true;
    }
    this.ACTION_OPEN = this.navigationService.ACTION_OPEN;
    this.ACTION_CLOSE = this.navigationService.ACTION_CLOSE;
    this.KEYBOARD_EVENT_TO_KEY_CODES =
      this.navigationService.KEYBOARD_EVENT_TO_KEY_CODES;
    this.windowIsNarrow = this.windowDimensionsService.isWindowNarrow();

    if (this.currentUrl !== 'signup') {
      this.learnerGroupBackendApiService
        .isLearnerGroupFeatureEnabledAsync()
        .then(featureIsEnabled => {
          this.LEARNER_GROUPS_FEATURE_IS_ENABLED = featureIsEnabled;
        });
    }

    this.menuIconIsShown = !this.PAGES_WITH_BACK_STATE.some(path =>
      this.urlService.getPathname().includes(path)
    );

    this.FEEDBACK_UPDATES_IN_PROFILE_PIC_DROP_DOWN_IS_ENABLED =
      this.isShowFeedbackUpdatesInProfilepicDropdownFeatureFlagEnable();

    // Inside a setTimeout function call, 'this' points to the global object.
    // To access the context in which the setTimeout call is made, we need to
    // first save a reference to that context in a variable, and then use that
    // variable in place of the 'this' keyword.
    let that = this;

    this.directiveSubscriptions.add(
      this.searchService.onSearchBarLoaded.subscribe(() => {
        setTimeout(function () {
          that.truncateNavbar();
        }, 100);
      })
    );

    this.i18nService.updateViewToUserPreferredSiteLanguage();

    this.userService.getUserInfoAsync().then(userInfo => {
      this.isModerator = userInfo.isModerator();
      this.isCurriculumAdmin = userInfo.isCurriculumAdmin();
      this.isTopicManager = userInfo.isTopicManager();
      this.isSuperAdmin = userInfo.isSuperAdmin();
      this.isBlogAdmin = userInfo.isBlogAdmin();
      this.isBlogPostEditor = userInfo.isBlogPostEditor();
      this.userIsLoggedIn = userInfo.isLoggedIn();
      let usernameFromUserInfo = userInfo.getUsername();
      if (this.userIsLoggedIn) {
        let feedbackUpdatesDataPromise =
          this.feedbackUpdatesBackendApiService.fetchFeedbackUpdatesDataAsync(
            this.paginatedThreadsList
          );
        feedbackUpdatesDataPromise.then(
          responseData => {
            this.unreadThreadsCount = responseData.numberOfUnreadThreads;
          },
          errorResponseStatus => {
            if (
              AppConstants.FATAL_ERROR_CODES.indexOf(errorResponseStatus) !== -1
            ) {
              this.alertsService.addWarning(
                'Failed to get number of unread thread of feedback updates'
              );
            }
          }
        );
      }
      if (usernameFromUserInfo) {
        this.username = usernameFromUserInfo;
        this.profilePageUrl = this.urlInterpolationService.interpolateUrl(
          '/profile/<username>',
          {
            username: this.username,
          }
        );
        [this.profilePicturePngDataUrl, this.profilePictureWebpDataUrl] =
          this.userService.getProfileImageDataUrl(this.username);
      } else {
        this.profilePicturePngDataUrl =
          this.urlInterpolationService.getStaticImageUrl(
            AppConstants.DEFAULT_PROFILE_IMAGE_PNG_PATH
          );
        this.profilePictureWebpDataUrl =
          this.urlInterpolationService.getStaticImageUrl(
            AppConstants.DEFAULT_PROFILE_IMAGE_WEBP_PATH
          );
      }
    });

    for (var i = 0; i < this.NAV_ELEMENTS_ORDER.length; i++) {
      this.navElementsVisibilityStatus[this.NAV_ELEMENTS_ORDER[i]] = true;
    }

    this.directiveSubscriptions.add(
      this.windowDimensionsService.getResizeEvent().subscribe(evt => {
        this.windowIsNarrow = this.windowDimensionsService.isWindowNarrow();
        // If window is resized larger, try displaying the hidden
        // elements.
        if (this.currentWindowWidth < this.windowDimensionsService.getWidth()) {
          for (var i = 0; i < this.NAV_ELEMENTS_ORDER.length; i++) {
            if (!this.navElementsVisibilityStatus[this.NAV_ELEMENTS_ORDER[i]]) {
              this.navElementsVisibilityStatus[this.NAV_ELEMENTS_ORDER[i]] =
                true;
            }
          }
        }

        // Close the sidebar, if necessary.
        this.sidebarStatusService.closeSidebar();
        this.sidebarIsShown = this.sidebarStatusService.isSidebarShown();
        this.currentWindowWidth = this.windowDimensionsService.getWidth();
        this.windowRef.nativeWindow.document.body.style.overflowY = 'auto';
        debounce(this.truncateNavbar, 500);
      })
    );

    this.directiveSubscriptions.add(
      this.i18nLanguageCodeService.onI18nLanguageCodeChange.subscribe(code => {
        if (this.currentLanguageCode !== code) {
          this.currentLanguageCode = code;
          this.supportedSiteLanguages.forEach(element => {
            if (element.id === this.currentLanguageCode) {
              this.currentLanguageText = element.text;
            }
          });
          this.changeDetectorRef.detectChanges();
        }
      })
    );

    let langCode = this.i18nLanguageCodeService.getCurrentI18nLanguageCode();

    if (this.currentLanguageCode !== langCode) {
      this.currentLanguageCode = langCode;
      this.supportedSiteLanguages.forEach(element => {
        if (element.id === this.currentLanguageCode) {
          this.currentLanguageText = element.text;
        }
      });
      this.changeDetectorRef.detectChanges();
    }

    // The function needs to be run after i18n. A timeout of 0 appears
    // to run after i18n in Chrome, but not other browsers. The
    // will check if i18n is complete and set a new timeout if it is
    // not. Since a timeout of 0 works for at least one browser,
    // it is used here.
    setTimeout(function () {
      that.truncateNavbar();
    }, 0);
  }

  ngAfterViewChecked(): void {
    this.getInvolvedMenuOffset = this.getDropdownOffset('.get-involved', 574);
    this.donateMenuOffset = this.getDropdownOffset('.donate-tab', 286);
    this.learnDropdownOffset = this.getDropdownOffset('.learn-tab', 688);
    // https://stackoverflow.com/questions/34364880/expression-has-changed-after-it-was-checked
    this.changeDetectorRef.detectChanges();
  }

  // This function is required to shift the dropdown towards left if
  // there isn't enough space on the right to fit the entire dropdown.
  // This function compares the width of the dropdown with the space
  // available on the right to calculate the offset. It returns zero if
  // there is enough space to fit the content.
  getDropdownOffset(cssClass: string, width: number): number {
    let learnTab: HTMLElement | null = document.querySelector(cssClass);
    if (learnTab) {
      let leftOffset = learnTab.getBoundingClientRect().left;
      let space = window.innerWidth - leftOffset;
      return space < width ? Math.round(space - width) : 0;
    }
    return 0;
  }

  getStaticImageUrl(imagePath: string): string {
    return this.urlInterpolationService.getStaticImageUrl(imagePath);
  }

  changeLanguage(languageCode: string): void {
    this.i18nService.updateUserPreferredLanguage(languageCode);
    this.languageBannerService.markLanguageBannerAsDismissed();
  }

  isLanguageRTL(): boolean {
    return this.i18nLanguageCodeService.isCurrentLanguageRTL();
  }

  onLoginButtonClicked(): void {
    this.userService.getLoginUrlAsync().then(loginUrl => {
      if (loginUrl) {
        this.siteAnalyticsService.registerStartLoginEvent('loginButton');
        setTimeout(() => {
          this.windowRef.nativeWindow.location.href = loginUrl;
        }, 150);
      } else {
        this.windowRef.nativeWindow.location.reload();
      }
    });
  }

  onLogoutButtonClicked(): void {
    this.windowRef.nativeWindow.localStorage.removeItem(
      'last_uploaded_audio_lang'
    );
  }

  /**
   * Opens the submenu.
   * @param {object} evt
   * @param {String} menuName - name of menu, on which
   * open/close action to be performed (aboutMenu,profileMenu).
   */
  openSubmenu(evt: KeyboardEvent, menuName: string): void {
    // Focus on the current target before opening its submenu.
    this.navigationService.openSubmenu(evt, menuName);
  }

  closeSubmenu(evt: KeyboardEvent): void {
    this.navigationService.closeSubmenu(evt);
  }

  closeSubmenuIfNotMobile(evt: KeyboardEvent): void {
    if (this.deviceInfoService.isMobileDevice()) {
      return;
    }
    this.closeSubmenu(evt);
  }

  /**
   * Handles keydown events on menus.
   * @param {object} evt
   * @param {String} menuName - name of menu to perform action
   * on(aboutMenu/profileMenu)
   * @param {object} eventsTobeHandled - Map keyboard events('Enter')
   * to corresponding actions to be performed(open/close).
   *
   * @example
   *  onMenuKeypress($event, 'aboutMenu', {enter: 'open'})
   */
  onMenuKeypress(
    evt: KeyboardEvent,
    menuName: string,
    eventsTobeHandled: EventToCodes
  ): void {
    this.navigationService.onMenuKeypress(evt, menuName, eventsTobeHandled);
    this.activeMenuName = this.navigationService.activeMenuName;
  }

  isSidebarShown(): boolean {
    return this.sidebarStatusService.isSidebarShown();
  }

  toggleSidebar(event: Event): void {
    this.sidebarStatusService.toggleSidebar();
    this.sidebarStatusService.toggleHamburgerIconStatus(event);
    if (this.isSidebarShown()) {
      this.windowRef.nativeWindow.document.body.style.overflowY = 'hidden';
    } else {
      this.windowRef.nativeWindow.document.body.style.overflowY = 'auto';
    }
  }

  ngOnDestroy(): void {
    this.directiveSubscriptions.unsubscribe();

    this.windowRef.nativeWindow.document.body.style.overflowY = 'auto';
  }

  /**
   * Checks if i18n has been run.
   * If i18n has not yet run, the <a> and <span> tags will have
   * no text content, so their innerText.length value will be 0.
   * @returns {boolean}
   */
  checkIfI18NCompleted(): boolean {
    var i18nCompleted = true;
    var tabs = document.querySelectorAll('.oppia-navbar-tab-content');
    for (var i = 0; i < tabs.length; i++) {
      if ((tabs[i] as HTMLElement).innerText.length === 0) {
        i18nCompleted = false;
        break;
      }
    }
    return i18nCompleted;
  }

  /**
   * Checks if window is >768px and i18n is completed, then checks
   * for overflow. If overflow is detected, hides the least important
   * tab and then calls itself again after a 50ms delay.
   */
  truncateNavbar(): void {
    // If the window is narrow, the standard nav tabs are not shown.
    if (this.windowDimensionsService?.isWindowNarrow()) {
      return;
    }

    let that = this;
    // If i18n hasn't completed, retry after 100ms.
    if (!this.checkIfI18NCompleted()) {
      setTimeout(function () {
        that.truncateNavbar();
      }, 100);
      return;
    }

    // The value of 60px used here comes from measuring the normal
    // height of the navbar (56px) in Chrome's inspector and rounding
    // up. If the height of the navbar is changed in the future this
    // will need to be updated.
    let navbar = document.querySelector('div.collapse.navbar-collapse');
    if (navbar && navbar.clientHeight > 60) {
      for (var i = 0; i < this.NAV_ELEMENTS_ORDER.length; i++) {
        if (this.navElementsVisibilityStatus[this.NAV_ELEMENTS_ORDER[i]]) {
          // Hide one element, then check again after 50ms.
          // This gives the browser time to render the visibility
          // change.
          this.navElementsVisibilityStatus[this.NAV_ELEMENTS_ORDER[i]] = false;
          // Force a digest cycle to hide element immediately.
          // Otherwise it would be hidden after the next call.
          // This is due to setTimeout use in debounce.
          setTimeout(function () {
            that.truncateNavbar();
          }, 50);
          return;
        }
      }
    }
  }

  isHackyTopicTitleTranslationDisplayed(index: number): boolean {
    return (
      this.i18nLanguageCodeService.isHackyTranslationAvailable(
        this.topicTitlesTranslationKeys[index]
      ) && !this.i18nLanguageCodeService.isCurrentLanguageEnglish()
    );
  }

  navigateToAboutPage(): void {
    this.siteAnalyticsService.registerClickNavbarButtonEvent(
      NavbarAndFooterGATrackingPages.ABOUT
    );
    this.windowRef.nativeWindow.location.href = '/about';
  }

  navigateToVolunteerPage(): void {
    this.siteAnalyticsService.registerClickNavbarButtonEvent(
      NavbarAndFooterGATrackingPages.VOLUNTEER
    );
    this.windowRef.nativeWindow.location.href = '/volunteer';
  }

  navigateToTeachPage(): void {
    this.siteAnalyticsService.registerClickNavbarButtonEvent(
      NavbarAndFooterGATrackingPages.TEACH
    );
    this.windowRef.nativeWindow.location.href = '/teach';
  }

  isShowFeedbackUpdatesInProfilepicDropdownFeatureFlagEnable(): boolean {
    return this.platformFeatureService.status
      .ShowFeedbackUpdatesInProfilePicDropdownMenu.isEnabled;
  }
}
