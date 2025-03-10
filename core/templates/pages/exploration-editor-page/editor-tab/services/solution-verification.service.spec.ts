// Copyright 2017 The Oppia Authors. All Rights Reserved.
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
 * @fileoverview Unit tests for Solution Verification Service.
 */

import {HttpClientTestingModule} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {StateCustomizationArgsService} from 'components/state-editor/state-editor-properties-services/state-customization-args.service';
import {StateEditorService} from 'components/state-editor/state-editor-properties-services/state-editor.service';
import {StateInteractionIdService} from 'components/state-editor/state-editor-properties-services/state-interaction-id.service';
import {Interaction} from 'domain/exploration/InteractionObjectFactory';
import {SolutionObjectFactory} from 'domain/exploration/SolutionObjectFactory';
import {SubtitledHtml} from 'domain/exploration/subtitled-html.model';
import INTERACTION_SPECS from 'interactions/interaction_specs.json';
import {SolutionVerificationService} from 'pages/exploration-editor-page/editor-tab/services/solution-verification.service';
import {ExplorationDataService} from 'pages/exploration-editor-page/services/exploration-data.service';
import {ExplorationStatesService} from 'pages/exploration-editor-page/services/exploration-states.service';

describe('Solution Verification Service', () => {
  let explorationStatesService: ExplorationStatesService;
  let stateInteractionIdService: StateInteractionIdService;
  let stateCustomizationArgsService: StateCustomizationArgsService;
  let solutionObjectFactory: SolutionObjectFactory;
  let solutionVerificationService: SolutionVerificationService;
  let stateEditorService: StateEditorService;
  let mockInteractionState: Record<string, unknown>;

  beforeEach(() => {
    mockInteractionState = {
      TextInput: {display_mode: 'inline', is_terminal: false},
      TerminalInteraction: {display_mode: 'inline', is_terminal: true},
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        StateInteractionIdService,
        StateCustomizationArgsService,
        SolutionObjectFactory,
        StateEditorService,
        SolutionVerificationService,
        ExplorationStatesService,
        {
          provide: INTERACTION_SPECS,
          useValue: mockInteractionState,
        },
        {
          provide: ExplorationDataService,
          useValue: {
            explorationId: 0,
            autosaveChangeListAsync: () => {},
          },
        },
      ],
    });

    explorationStatesService = TestBed.inject(ExplorationStatesService);
    stateInteractionIdService = TestBed.inject(StateInteractionIdService);
    stateCustomizationArgsService = TestBed.inject(
      StateCustomizationArgsService
    );
    solutionObjectFactory = TestBed.inject(SolutionObjectFactory);
    stateEditorService = TestBed.inject(StateEditorService);
    solutionVerificationService = TestBed.inject(SolutionVerificationService);

    explorationStatesService.init({
      'First State': {
        content: {content_id: 'content', html: 'First State Content'},
        recorded_voiceovers: {
          voiceovers_mapping: {
            content: {},
            default_outcome: {},
            feedback_1: {},
            hint_1: {},
            hint_2: {},
          },
        },
        interaction: {
          id: 'TextInput',
          answer_groups: [
            {
              outcome: {
                dest: 'End State',
                dest_if_really_stuck: null,
                feedback: {content_id: 'feedback_1', html: ''},
                labelled_as_correct: false,
                param_changes: [],
                refresher_exploration_id: null,
              },
              rule_specs: [
                {
                  rule_type: 'Contains',
                  inputs: {
                    x: {contentId: 'rule_input', normalizedStrSet: ['abc']},
                  },
                },
              ],
            },
          ],
          customization_args: {
            placeholder: {
              value: {content_id: 'ca_placeholder_0', unicode_str: ''},
            },
            rows: {value: 1},
            catchMisspellings: {value: false},
          },
          default_outcome: {
            dest: 'First State',
            dest_if_really_stuck: null,
            feedback: {content_id: 'default_outcome', html: ''},
            labelled_as_correct: false,
            param_changes: [],
          },
          hints: [
            {hint_content: {content_id: 'hint_1', html: 'one'}},
            {hint_content: {content_id: 'hint_2', html: 'two'}},
          ],
        },
        param_changes: [],
        solicit_answer_details: false,
      },
    });
  });

  it('should verify a correct solution', () => {
    const state = explorationStatesService.getState('First State');
    stateInteractionIdService.init(
      'First State',
      state.interaction.id,
      state.interaction,
      'widget_id'
    );
    stateCustomizationArgsService.init(
      'First State',
      state.interaction.customizationArgs,
      state.interaction,
      'widget_customization_args'
    );

    stateInteractionIdService.savedMemento = 'TextInput';
    explorationStatesService.saveSolution(
      'First State',
      solutionObjectFactory.createNew(false, 'abc', 'nothing')
    );

    expect(
      solutionVerificationService.verifySolution(
        'First State',
        state.interaction,
        explorationStatesService.getState('First State').interaction.solution
          .correctAnswer
      )
    ).toBe(true);
  });

  it('should verify an incorrect solution', () => {
    const state = explorationStatesService.getState('First State');
    stateInteractionIdService.init(
      'First State',
      state.interaction.id,
      state.interaction,
      'widget_id'
    );
    stateCustomizationArgsService.init(
      'First State',
      state.interaction.customizationArgs,
      state.interaction,
      'widget_customization_args'
    );

    stateInteractionIdService.savedMemento = 'TextInput';
    explorationStatesService.saveSolution(
      'First State',
      solutionObjectFactory.createNew(false, 'xyz', 'nothing')
    );

    expect(
      solutionVerificationService.verifySolution(
        'First State',
        state.interaction,
        explorationStatesService.getState('First State').interaction.solution
          .correctAnswer
      )
    ).toBe(false);
  });

  it("should throw an error if Interaction's id is null", () => {
    const interaction = new Interaction(
      [],
      [],
      {choices: {value: [new SubtitledHtml('This is a choice', '')]}},
      null,
      [],
      null,
      null
    );

    expect(() => {
      solutionVerificationService.verifySolution(
        'State 1',
        interaction,
        'Answer'
      );
    }).toThrowError('Interaction ID must not be null');
  });

  it('should return outcome.labelledAsCorrect when in question mode', () => {
    spyOn(stateEditorService, 'isInQuestionMode').and.returnValue(true);

    const state = explorationStatesService.getState('First State');
    stateInteractionIdService.init(
      'First State',
      state.interaction.id,
      state.interaction,
      'widget_id'
    );
    stateCustomizationArgsService.init(
      'First State',
      state.interaction.customizationArgs,
      state.interaction,
      'widget_customization_args'
    );

    stateInteractionIdService.savedMemento = 'TextInput';
    explorationStatesService.saveSolution(
      'First State',
      solutionObjectFactory.createNew(false, 'abc', 'nothing')
    );

    expect(
      solutionVerificationService.verifySolution(
        'First State',
        state.interaction,
        explorationStatesService.getState('First State').interaction.solution
          .correctAnswer
      )
    ).toBe(state.interaction.answerGroups[0].outcome.labelledAsCorrect);
  });
});
