// Copyright 2014 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Directive for the Tabs rich-text component.
 *
 * IMPORTANT NOTE: The naming convention for customization args that are passed
 * into the directive is: the name of the parameter, followed by 'With',
 * followed by the name of the arg.
 *
 * All of the RTE components follow this pattern of updateView and ngOnChanges.
 * This is because these are also web-components (So basically, we can create
 * this component using document.createElement). CKEditor creates instances of
 * these on the fly and runs ngOnInit before we can set the @Input properties.
 * When the input properties are not set, we get errors in the console.
 * The `if` condition in update view prevents that from happening.
 * The `if` condition in the updateView and ngOnChanges might look like the
 * literal opposite but that's not the case. We know from the previous
 * statements above that the if condition in the updateView is for preventing
 * the code to run until all the values needed for successful execution are
 * present. The if condition in ngOnChanges is to optimize the re-runs of
 * updateView and only re-run when a property we care about has changed in
 * value.
 */

import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import {HtmlEscaperService} from 'services/html-escaper.service';

export interface TabContent {
  title: string;
  content: string;
}

@Component({
  selector: 'oppia-noninteractive-tabs',
  templateUrl: './tabs.component.html',
  styleUrls: [],
})
export class NoninteractiveTabs implements OnInit, OnChanges {
  // This property is initialized using Angular lifecycle hooks
  // and we need to do non-null assertion. For more information, see
  // https://github.com/oppia/oppia/wiki/Guide-on-defining-types#ts-7-1
  @Input() tabContentsWithValue!: string;
  tabContents: TabContent[] = [];

  constructor(private htmlEscaperService: HtmlEscaperService) {}

  private _updateViewOnTabContentChange(): void {
    if (!this.tabContentsWithValue) {
      return;
    }
    this.tabContents = this.htmlEscaperService.escapedJsonToObj(
      this.tabContentsWithValue
    ) as TabContent[];
  }

  ngOnInit(): void {
    this._updateViewOnTabContentChange();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.tabContentsWithValue) {
      this._updateViewOnTabContentChange();
    }
  }
}
