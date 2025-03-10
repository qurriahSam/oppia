// Copyright 2023 The Oppia Authors. All Rights Reserved.
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
 * @fileoverview Service to persist multiple choices order between submissions.
 */

import {Injectable} from '@angular/core';

import {SubtitledHtml} from 'domain/exploration/subtitled-html.model';

export interface ChoiceWithIndex {
  originalIndex: number;
  choice: SubtitledHtml;
}

@Injectable({
  providedIn: 'root',
})
export class MultipleChoiceInputOrderedChoicesService {
  private choices: ChoiceWithIndex[] = [];
  store(choices: ChoiceWithIndex[]): void {
    this.choices = choices;
  }

  get(): ChoiceWithIndex[] {
    return this.choices;
  }
}
