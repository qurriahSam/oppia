// Copyright 2019 The Oppia Authors. All Rights Reserved.
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
 * @fileoverview Tests for the convert HTML to Unicode pipe.
 */

import {ConvertHtmlToUnicodePipe} from './convert-html-to-unicode.pipe';

describe('ConvertHtmlToUnicodePipe', () => {
  let pipe: ConvertHtmlToUnicodePipe;

  beforeEach(() => {
    pipe = new ConvertHtmlToUnicodePipe();
  });

  it('should convert HTML entities to Unicode text correctly', () => {
    const htmlUnicodeHtmlPairings = [
      ['abc', 'abc'],
      ['&lt;a&copy;&deg;', '<a©°'],
      ['<b>a</b>', 'a'],
      ['<br>a', 'a'],
      ['<br/>a', 'a'],
      ['<br></br>a', 'a'],
      ['abc  a', 'abc  a'],
    ];

    htmlUnicodeHtmlPairings.forEach(([input, expected]) => {
      expect(pipe.transform(input)).toEqual(expected);
    });
  });
});
