# coding: utf-8
#
# Copyright 2023 The Oppia Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the 'License');
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an 'AS-IS' BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Stats generation jobs for contributor admin dashboard."""

from __future__ import annotations

from core import feconf
from core.domain import exp_services
from core.domain import skill_services
from core.domain import story_fetchers
from core.domain import topic_fetchers
from core.jobs import base_jobs
from core.jobs.io import ndb_io
from core.jobs.transforms import job_result_transforms
from core.jobs.types import job_run_result
from core.platform import models

import apache_beam as beam
from typing import Iterable, List, Optional, Tuple

MYPY = False
if MYPY: # pragma: no cover
    from mypy_imports import datastore_services
    from mypy_imports import opportunity_models
    from mypy_imports import suggestion_models

(opportunity_models, suggestion_models, ) = models.Registry.import_models([
    models.Names.OPPORTUNITY, models.Names.SUGGESTION
])

datastore_services = models.Registry.import_datastore_services()


class GenerateContributorAdminStatsJob(base_jobs.JobBase):
    """Job that populates model with stats used in contributor admin
    dashboard
    """

    DATASTORE_UPDATES_ALLOWED = True

    def run(self) -> beam.PCollection[job_run_result.JobRunResult]:
        """Generates the stats for contributor admin dashboard.

        Returns:
            PCollection. A PCollection of 'SUCCESS x' results, where x is
            the number of generated stats.
        """

        general_suggestions_models = (
            self.pipeline
            | 'Get non-deleted GeneralSuggestionModel' >> ndb_io.GetModels(
                suggestion_models.GeneralSuggestionModel.get_all(
                    include_deleted=False))
        )

        translation_general_suggestions_stats = (
            general_suggestions_models
             | 'Filter reviewed translate suggestions' >> beam.Filter(
                lambda m: (
                    m.suggestion_type ==
                    feconf.SUGGESTION_TYPE_TRANSLATE_CONTENT
                ))
            | 'Group by language and user' >> beam.Map(
                lambda stats: ((stats.language_code, stats.author_id), stats)
            )
        )

        question_general_suggestions_stats = (
            general_suggestions_models
             | 'Filter reviewed questions suggestions' >> beam.Filter(
                lambda m: (
                    m.suggestion_type ==
                    feconf.SUGGESTION_TYPE_ADD_QUESTION
                ))
            | 'Group by user' >> beam.Map(
                lambda stats: (stats.author_id, stats)
            )
        )

        translation_contribution_stats = (
            self.pipeline
            | 'Get all non-deleted TranslationContributionStatsModel models' >>
                ndb_io.GetModels(
                suggestion_models.TranslationContributionStatsModel.get_all(
                    include_deleted=False))
            | 'Filter translation contribution with no topic' >> beam.Filter(
                lambda m: m.topic_id != '')
            | 'Group TranslationContributionStatsModel by language and contributor' # pylint: disable=line-too-long
                >> beam.Map(
                lambda stats: (
                    (stats.language_code, stats.contributor_user_id), stats
                )
            )
        )

        translation_reviewer_stats = (
            self.pipeline
            | 'Get all non-deleted TranslationReviewStatsModel models' >>
                ndb_io.GetModels(
                suggestion_models.TranslationReviewStatsModel.get_all(
                    include_deleted=False))
            | 'Group TranslationReviewStatsModel by language and reviewer'
                >> beam.Map(
                lambda stats: (
                    (stats.language_code, stats.reviewer_user_id), stats
                )
            )
        )

        question_contribution_stats = (
            self.pipeline
            | 'Get all non-deleted QuestionContributionStatsModel models' >>
                ndb_io.GetModels(
                suggestion_models.QuestionContributionStatsModel.get_all(
                    include_deleted=False))
            | 'Group QuestionContributionStatsModel by contributor'
                >> beam.Map(
                lambda stats: (
                    stats.contributor_user_id, stats
                )
            )
        )

        question_reviewer_stats = (
            self.pipeline
            | 'Get all non-deleted QuestionReviewStatsModel models' >>
                ndb_io.GetModels(
                suggestion_models.QuestionReviewStatsModel.get_all(
                    include_deleted=False))
            | 'Group QuestionReviewStatsModel by contributor'
                >> beam.Map(
                lambda stats: (
                    stats.reviewer_user_id, stats
                )
            )
        )

        translation_submitter_total_stats_models_and_logs = (
            {
                'translation_contribution_stats':
                    translation_contribution_stats,
                'translation_general_suggestions_stats':
                    translation_general_suggestions_stats
            }
            | 'Merge Translation models' >> beam.CoGroupByKey()
            | 'Transform translation contribution stats' >>
                beam.MapTuple(
                    lambda key, value:
                        self.transform_translation_contribution_stats(
                            key,
                            value['translation_contribution_stats'],
                            value['translation_general_suggestions_stats']
                        )
                )
        )

        translation_submitter_total_stats_models = (
            translation_submitter_total_stats_models_and_logs
            | 'Unpack translation submitter contribution models' >> beam.Map(
                lambda element: element[0])
            | 'Filter out translation stats with None values' >> beam.Filter(
                lambda x: x is not None)
        )

        translation_submitter_debug_logs = (
            translation_submitter_total_stats_models_and_logs
            | 'Filter out translation logs with None values' >> beam.Filter(
                lambda element: element[1] is not None)
            | 'Unpack and get translation debug logs result' >> beam.Map(
                lambda element: (
                    job_run_result.JobRunResult.as_stdout(element[1])
                )
            )
        )

        translation_reviewer_total_stats_models = (
            translation_reviewer_stats
            | 'Group TranslationReviewerTotalContributionStatsModel by key' >>
                beam.GroupByKey()
            | 'Transform translation reviewer stats' >>
                beam.MapTuple(self.transform_translation_review_stats)
        )

        question_submitter_total_stats_models_and_logs = (
            {
                'question_contribution_stats':
                    question_contribution_stats,
                'question_general_suggestions_stats':
                    question_general_suggestions_stats
            }
            | 'Merge Question models' >> beam.CoGroupByKey()
            | 'Transform question contribution stats' >>
                beam.MapTuple(
                    lambda key, value:
                        self.transform_question_contribution_stats(
                            key,
                            value['question_contribution_stats'],
                            value['question_general_suggestions_stats']
                        )
                )
        )

        question_submitter_total_stats_models = (
            question_submitter_total_stats_models_and_logs
            | 'Unpack question contribution models' >> beam.Map(
                lambda element: element[0])
            | 'Filter out question stats with None values' >> beam.Filter(
                lambda x: x is not None)
        )

        question_submitter_debug_logs = (
            question_submitter_total_stats_models_and_logs
            | 'Filter out question logs with None values' >> beam.Filter(
                lambda element: element[1] is not None)
            | 'Unpack and get question debug logs result' >> beam.Map(
                lambda element: (
                    job_run_result.JobRunResult.as_stdout(element[1])
                )
            )
        )

        question_reviewer_total_stats_models = (
            question_reviewer_stats
            | 'Group QuestionReviewerTotalContributionStatsModel by key' >>
                beam.GroupByKey()
            | 'Transform question reviewer stats' >>
                beam.MapTuple(self.transform_question_review_stats)
        )

        if self.DATASTORE_UPDATES_ALLOWED:
            unused_translation_submitter_put_results = (
                translation_submitter_total_stats_models
                | 'Put TranslationSubmitterTotalContributionStatsModel models'
                    >> ndb_io.PutModels()
            )

            unused_translation_reviewer_put_results = (
                translation_reviewer_total_stats_models
                | 'Put TranslationReviewerTotalContributionStatsModel models'
                    >> ndb_io.PutModels()
            )

            unused_question_submitter_put_results = (
                question_submitter_total_stats_models
                | 'Put QuestionSubmitterTotalContributionStatsModel models'
                    >> ndb_io.PutModels()
            )

            unused_question_reviewer_put_results = (
                question_reviewer_total_stats_models
                | 'Put QuestionReviewerTotalContributionStatsModel models'
                    >> ndb_io.PutModels()
            )

        translation_submitter_models_job_run_results = (
            translation_submitter_total_stats_models
            | 'Create translation submitter job run result' >> (
                job_result_transforms.CountObjectsToJobRunResult(
                    'Translation Submitter Models'
                ))
        )

        translation_reviewer_models_job_run_results = (
            translation_reviewer_total_stats_models
            | 'Create translation reviewer job run result' >> (
                job_result_transforms.CountObjectsToJobRunResult(
                    'Translation Reviewer Models'
                ))
        )

        question_submitter_models_job_run_results = (
            question_submitter_total_stats_models
            | 'Create question submitter job run result' >> (
                job_result_transforms.CountObjectsToJobRunResult(
                    'Question Submitter Models'
                ))
        )

        question_reviewer_models_job_run_results = (
            question_reviewer_total_stats_models
            | 'Create question reviewer job run result' >> (
                job_result_transforms.CountObjectsToJobRunResult(
                    'Question Reviewer Models'
                ))
        )

        return (
            (
                translation_submitter_models_job_run_results,
                translation_reviewer_models_job_run_results,
                question_submitter_models_job_run_results,
                question_reviewer_models_job_run_results,
                translation_submitter_debug_logs,
                question_submitter_debug_logs
            )
            | 'Merge job run results' >> beam.Flatten()
        )

    @staticmethod
    def transform_translation_contribution_stats(
        keys: Tuple[str, str],
        translation_contribution_stats:
            Iterable[suggestion_models.TranslationContributionStatsModel],
        translation_general_suggestions_stats:
            Iterable[suggestion_models.GeneralSuggestionModel]) -> Tuple[
        Optional[
            suggestion_models.TranslationSubmitterTotalContributionStatsModel],
        Optional[str]]:
        """Transforms TranslationContributionStatsModel and
        GeneralSuggestionModel to
        TranslationSubmitterTotalContributionStatsModel.

        Args:
            keys: Tuple[str, str].
                Tuple of (language_code, contributor_user_id).
            translation_contribution_stats:
                Iterable[suggestion_models.TranslationContributionStatsModel].
                TranslationReviewStatsModel grouped by
                (language_code, contributor_user_id).
            translation_general_suggestions_stats:
                Iterable[suggestion_models.GeneralSuggestionModel].
                TranslationReviewStatsModel grouped by
                (language_code, author_id).

        Returns:
            A 2-tuple with the following elements:
            - suggestion_models.TranslationSubmitterTotalContributionStatsModel.
            New TranslationReviewerTotalContributionStatsModel model, if
            possible.
            - The debug logs, if error detected.
        """
        # The key for sorting is defined separately because of a mypy bug.
        # A [no-any-return] is thrown if key is defined in the sort() method
        # instead. Reference: https://github.com/python/mypy/issues/9590.
        by_created_on = lambda m: m.created_on
        translation_general_suggestions_sorted_stats = sorted(
            translation_general_suggestions_stats,
            key=by_created_on
        )

        translation_contribution_stats = list(translation_contribution_stats)
        general_suggestion_stats = list(
            translation_general_suggestions_sorted_stats)
        recent_review_outcomes = []

        counts = {
            'accepted': 0,
            'accepted_with_edits': 0,
            'rejected': 0
        }

        for v in general_suggestion_stats:
            if (v.status == 'accepted' and v.edited_by_reviewer is False):
                recent_review_outcomes.append('accepted')
            elif (v.status == 'accepted' and v.edited_by_reviewer is True):
                recent_review_outcomes.append('accepted_with_edits')
            elif v.status == 'rejected':
                recent_review_outcomes.append('rejected')

        if len(recent_review_outcomes) > 100:
            recent_review_outcomes = recent_review_outcomes[-100:]

        # Iterate over the list and count occurrences.
        for outcome in recent_review_outcomes:
            counts[outcome] += 1

        # Weights of recent_performance as documented in
        # https://docs.google.com/document/d/19lCEYQUgV7_DwIK_0rz3zslRHX2qKOHn-t9Twpi0qu0/edit.
        recent_performance = (
            (counts['accepted'] + counts['accepted_with_edits'])
            - (2 * (counts['rejected']))
            )

        language_code, contributor_user_id = keys
        entity_id = (
            '%s.%s' % (language_code, contributor_user_id)
        )

        exp_ids_with_translation_suggestions = sorted(
            {v.target_id for v in general_suggestion_stats})

        topic_ids_with_translation_submissions_list = []
        with datastore_services.get_ndb_context():
            for exp_id in exp_ids_with_translation_suggestions:
                story_id = exp_services.get_story_id_linked_to_exploration(
                    exp_id)
                if story_id is not None:
                    story = story_fetchers.get_story_by_id(story_id)
                    if story is not None:
                        topic_ids_with_translation_submissions_list.append(
                            story.corresponding_topic_id)

        topic_ids_with_translation_submissions = sorted(
            set(topic_ids_with_translation_submissions_list))

        topic_ids_with_contribution_stats = sorted(
            {v.topic_id for v in translation_contribution_stats})

        for stat in translation_contribution_stats:
            if GenerateContributorAdminStatsJob.not_validate_topic(
                stat.topic_id):
                translation_contribution_stats.remove(stat)

        valid_topic_ids_with_contribution_stats = sorted(
            {v.topic_id for v in translation_contribution_stats})

        # We only generate total contribution stats model if there exists a
        # valid contribution stats model for each pair of language code and
        # topic id, a contributor submitted a translation suggestion to.
        # Otherwise we return the debugging logs.
        if topic_ids_with_translation_submissions != (
            valid_topic_ids_with_contribution_stats):

            # Collects all the debug logs.
            debug_logs = (
                'Translation submitter ID: %s, Language code: %s\n' % (
                    contributor_user_id, language_code))

            debug_logs += (
                'Unique exp IDs with translation suggestion: \n')

            with datastore_services.get_ndb_context():
                for exp_id in exp_ids_with_translation_suggestions:
                    debug_logs += (
                        '- %s\n' % exp_id)
                    story_id = exp_services.get_story_id_linked_to_exploration(
                        exp_id)
                    if story_id is not None:
                        debug_logs += (
                            '-- Story ID: %s\n' % story_id)
                        story = story_fetchers.get_story_by_id(story_id)
                        if story is not None:
                            debug_logs += (
                                '---- Topic ID: %s\n' % (
                                    story.corresponding_topic_id))

            debug_logs += (
                'Unique topic IDs with contribution stats: \n')
            for topic_id in topic_ids_with_contribution_stats:
                debug_logs += (
                    '- %s\n' % topic_id)

            debug_logs += (
                'Unique valid topic IDs with contribution stats: \n')
            for topic_id in valid_topic_ids_with_contribution_stats:
                debug_logs += (
                    '- %s\n' % topic_id)
            return (None, debug_logs)

        else:
            topic_ids = (
                [v.topic_id for v in translation_contribution_stats])
            submitted_translations_count = sum(
                v.submitted_translations_count
                    for v in translation_contribution_stats)
            submitted_translation_word_count = sum(
                v.submitted_translation_word_count
                    for v in translation_contribution_stats)
            accepted_translations_count = sum(
                v.accepted_translations_count
                    for v in translation_contribution_stats)
            accepted_translations_without_reviewer_edits_count = sum(
                v.accepted_translations_without_reviewer_edits_count
                    for v in translation_contribution_stats)
            accepted_translation_word_count = sum(
                v.accepted_translation_word_count
                    for v in translation_contribution_stats)
            rejected_translations_count = sum(
                v.rejected_translations_count
                    for v in translation_contribution_stats)
            rejected_translation_word_count = sum(
                v.rejected_translation_word_count
                    for v in translation_contribution_stats)
            first_contribution_date = min(
                v.contribution_dates[0] for v in translation_contribution_stats)
            last_contribution_date = max(
                v.contribution_dates[-1] for v in (
                    translation_contribution_stats))

            # Weights of overall_accuracy as documented in
            # https://docs.google.com/document/d/19lCEYQUgV7_DwIK_0rz3zslRHX2qKOHn-t9Twpi0qu0/edit.
            overall_accuracy = round(
                (accepted_translations_count / submitted_translations_count) * (
                    100), 2
            )

            with datastore_services.get_ndb_context():
                translation_submit_stats_models = (
                    suggestion_models.TranslationSubmitterTotalContributionStatsModel( # pylint: disable=line-too-long
                    id=entity_id,
                    language_code=language_code,
                    contributor_id=contributor_user_id,
                    topic_ids_with_translation_submissions=topic_ids,
                    recent_review_outcomes=recent_review_outcomes,
                    recent_performance=recent_performance,
                    overall_accuracy=overall_accuracy,
                    submitted_translations_count=submitted_translations_count,
                    submitted_translation_word_count=(
                        submitted_translation_word_count),
                    accepted_translations_count=accepted_translations_count,
                    accepted_translations_without_reviewer_edits_count=(
                        accepted_translations_without_reviewer_edits_count),
                    accepted_translation_word_count=(
                        accepted_translation_word_count),
                    rejected_translations_count=rejected_translations_count,
                    rejected_translation_word_count=(
                        rejected_translation_word_count),
                    first_contribution_date=first_contribution_date,
                    last_contribution_date=last_contribution_date
                    )
                )
                translation_submit_stats_models.update_timestamps()
                return (translation_submit_stats_models, None)

    @staticmethod
    def transform_translation_review_stats(
        keys: Tuple[str, str],
        translation_reviewer_stats:
            Iterable[suggestion_models.TranslationReviewStatsModel]) -> (
        suggestion_models.TranslationReviewerTotalContributionStatsModel):
        """Transforms TranslationReviewStatsModel to
        TranslationReviewerTotalContributionStatsModel.

        Args:
            keys: Tuple[str, str]. Tuple of
                (language_code, reviewer_user_id).
            translation_reviewer_stats:
                Iterable[suggestion_models.TranslationReviewStatsModel].
                TranslationReviewStatsModel grouped by
                (language_code, reviewer_user_id).

        Returns:
            suggestion_models
            .TranslationReviewerTotalContributionStatsModel.
            New TranslationReviewerTotalContributionStatsModel model.
        """

        translation_reviewer_stats = list(translation_reviewer_stats)

        language_code, reviewer_user_id = keys
        entity_id = (
            '%s.%s' % (language_code, reviewer_user_id)
        )

        for stat in translation_reviewer_stats:
            if GenerateContributorAdminStatsJob.not_validate_topic(
                stat.topic_id):
                translation_reviewer_stats.remove(stat)

        topic_ids = (
            [v.topic_id for v in translation_reviewer_stats])
        reviewed_translations_count = sum(
            v.reviewed_translations_count
                for v in translation_reviewer_stats)
        accepted_translations_count = sum(
            v.accepted_translations_count
                for v in translation_reviewer_stats)
        accepted_translations_with_reviewer_edits_count = sum(
            v.accepted_translations_with_reviewer_edits_count
                for v in translation_reviewer_stats)
        accepted_translation_word_count = sum(
            v.accepted_translation_word_count
                for v in translation_reviewer_stats)
        rejected_translations_count = (
            reviewed_translations_count - accepted_translations_count
        )
        first_contribution_date = min(
            v.first_contribution_date for v in translation_reviewer_stats)
        last_contribution_date = max(
            v.last_contribution_date for v in translation_reviewer_stats)

        with datastore_services.get_ndb_context():
            translation_review_stats_models = (
                suggestion_models.TranslationReviewerTotalContributionStatsModel( # pylint: disable=line-too-long
                id=entity_id,
                language_code=language_code,
                contributor_id=reviewer_user_id,
                topic_ids_with_translation_reviews=topic_ids,
                reviewed_translations_count=reviewed_translations_count,
                accepted_translations_count=accepted_translations_count,
                accepted_translations_with_reviewer_edits_count=(
                    accepted_translations_with_reviewer_edits_count),
                accepted_translation_word_count=(
                    accepted_translation_word_count),
                rejected_translations_count=rejected_translations_count,
                first_contribution_date=first_contribution_date,
                last_contribution_date=last_contribution_date
                )
            )
            translation_review_stats_models.update_timestamps()
            return translation_review_stats_models

    @staticmethod
    def transform_question_contribution_stats(
        contributor_user_id: str,
        question_contribution_stats:
            Iterable[suggestion_models.QuestionContributionStatsModel],
        question_general_suggestions_stats:
            Iterable[suggestion_models.GeneralSuggestionModel]) -> Tuple[
                Optional[suggestion_models.QuestionSubmitterTotalContributionStatsModel],  # pylint: disable=line-too-long
                Optional[str]]:
        """Transforms QuestionContributionStatsModel and GeneralSuggestionModel
        to QuestionSubmitterTotalContributionStatsModel.

        Args:
            contributor_user_id: str. User ID acting as a key to new model.
            question_contribution_stats:
                Iterable[suggestion_models.QuestionContributionStatsModel].
                QuestionContributionStatsModel grouped by
                contributor_user_id.
            question_general_suggestions_stats:
                Iterable[suggestion_models.GeneralSuggestionModel].
                GeneralSuggestionModel grouped by author_id.

        Returns:
            A 2-tuple with the following elements:
            - suggestion_models.QuestionSubmitterTotalContributionStatsModel.
            New QuestionSubmitterTotalContributionStatsModel model, if
            possible.
            - The debug logs, if error detected.
        """
        # The key for sorting is defined separately because of a mypy bug.
        # A [no-any-return] is thrown if key is defined in the sort() method
        # instead. Reference: https://github.com/python/mypy/issues/9590.
        by_created_on = lambda m: m.created_on
        question_general_suggestions_sorted_stats = sorted(
            question_general_suggestions_stats,
            key=by_created_on
        )

        question_contribution_stats = list(question_contribution_stats)
        general_suggestion_stats = list(
            question_general_suggestions_sorted_stats)
        recent_review_outcomes = []
        rejected_questions_count = 0

        counts = {
            'accepted': 0,
            'accepted_with_edits': 0,
            'rejected': 0
        }

        for v in general_suggestion_stats:
            if (v.status == 'accepted' and v.edited_by_reviewer is False):
                recent_review_outcomes.append('accepted')
            elif (v.status == 'accepted' and v.edited_by_reviewer is True):
                recent_review_outcomes.append('accepted_with_edits')
            elif v.status == 'rejected':
                recent_review_outcomes.append('rejected')
                rejected_questions_count += 1

        if len(recent_review_outcomes) > 100:
            recent_review_outcomes = recent_review_outcomes[-100:]

        # Iterate over the list and count occurrences.
        for outcome in recent_review_outcomes:
            counts[outcome] += 1

        # Weights of recent_performance as documented in
        # https://docs.google.com/document/d/19lCEYQUgV7_DwIK_0rz3zslRHX2qKOHn-t9Twpi0qu0/edit.
        recent_performance = (
            (counts['accepted'] + counts['accepted_with_edits'])
            - (2 * (counts['rejected']))
            )

        entity_id = contributor_user_id

        by_topic_id = lambda m: m.topic_id

        skill_ids_with_question_suggestions = sorted(
            {v.target_id for v in general_suggestion_stats})

        topic_ids_with_question_submissions_list = []
        with datastore_services.get_ndb_context():
            for skill_id in skill_ids_with_question_suggestions:
                topic_assignments = sorted(
                    skill_services.get_all_topic_assignments_for_skill(
                        skill_id), key=by_topic_id)
                for topic_assignment in topic_assignments:
                    topic_ids_with_question_submissions_list.append(
                        topic_assignment.topic_id)

        topic_ids_with_question_submissions = sorted(
            set(topic_ids_with_question_submissions_list))

        topic_ids_with_contribution_stats = sorted(
            {v.topic_id for v in question_contribution_stats})

        for stat in question_contribution_stats:
            if GenerateContributorAdminStatsJob.not_validate_topic(
                stat.topic_id):
                question_contribution_stats.remove(stat)

        valid_topic_ids_with_contribution_stats = sorted(
            {v.topic_id for v in question_contribution_stats})

        # We only generate total contribution stats model if there exists a
        # valid contribution stats model for each topic id, a contributor
        # submitted a question suggestion to. Otherwise we return the debugging
        # logs.
        if topic_ids_with_question_submissions != (
            valid_topic_ids_with_contribution_stats):

            # Collects all the debug logs.
            debug_logs = (
                'Question submitter ID: %s.\n' % contributor_user_id)

            debug_logs += (
                'Unique skill IDs with question suggestion: \n')

            with datastore_services.get_ndb_context():
                for skill_id in skill_ids_with_question_suggestions:
                    debug_logs += (
                        '- %s\n' % skill_id)
                    topic_assignments = sorted(
                        skill_services.get_all_topic_assignments_for_skill(
                            skill_id), key=by_topic_id)
                    for topic_assignment in topic_assignments:
                        debug_logs += (
                            '-- Topic ID: %s\n' % topic_assignment.topic_id)

            debug_logs += (
                'Unique topic IDs with contribution stats: \n')
            for topic_id in topic_ids_with_contribution_stats:
                debug_logs += (
                    '- %s\n' % topic_id)

            debug_logs += (
                'Unique valid topic IDs with contribution stats: \n')
            for topic_id in valid_topic_ids_with_contribution_stats:
                debug_logs += (
                    '- %s\n' % topic_id)
            return (None, debug_logs)

        else:
            topic_ids = (
                [v.topic_id for v in question_contribution_stats])
            submitted_questions_count = sum(
                v.submitted_questions_count
                    for v in question_contribution_stats)
            accepted_questions_count = sum(
                v.accepted_questions_count
                    for v in question_contribution_stats)
            accepted_questions_without_reviewer_edits_count = sum(
                v.accepted_questions_without_reviewer_edits_count
                    for v in question_contribution_stats)
            first_contribution_date = min(
                (v.first_contribution_date for v in (
                    question_contribution_stats)))

            last_contribution_date = max(
                (v.last_contribution_date for v in (
                    question_contribution_stats)))

            # Weights of overall_accuracy as documented in
            # https://docs.google.com/document/d/19lCEYQUgV7_DwIK_0rz3zslRHX2qKOHn-t9Twpi0qu0/edit.
            overall_accuracy = (
                round(
                accepted_questions_count / submitted_questions_count
                * 100, 2)
            )

            with datastore_services.get_ndb_context():
                question_submit_stats_models = (
                    suggestion_models.QuestionSubmitterTotalContributionStatsModel( # pylint: disable=line-too-long
                    id=entity_id,
                    contributor_id=contributor_user_id,
                    topic_ids_with_question_submissions=topic_ids,
                    recent_review_outcomes=recent_review_outcomes,
                    recent_performance=recent_performance,
                    overall_accuracy=overall_accuracy,
                    submitted_questions_count=submitted_questions_count,
                    accepted_questions_count=accepted_questions_count,
                    accepted_questions_without_reviewer_edits_count=(
                        accepted_questions_without_reviewer_edits_count),
                    rejected_questions_count=rejected_questions_count,
                    first_contribution_date=first_contribution_date,
                    last_contribution_date=last_contribution_date
                    )
                )
                question_submit_stats_models.update_timestamps()
                return (question_submit_stats_models, None)

    @staticmethod
    def transform_question_review_stats(
        reviewer_user_id: str,
        question_reviewer_stats:
            Iterable[suggestion_models.QuestionReviewStatsModel]) -> (
                suggestion_models.QuestionReviewerTotalContributionStatsModel):
        """Transforms QuestionReviewStatsModel to
        QuestionReviewerTotalContributionStatsModel.

        Args:
            reviewer_user_id: str. User ID acting as a key to new model.
            question_reviewer_stats:
                Iterable[suggestion_models.QuestionReviewStatsModel].
                QuestionReviewStatsModel grouped by
                reviewer_user_id.

        Returns:
            suggestion_models.QuestionReviewerTotalContributionStatsModel.
            New QuestionReviewerTotalContributionStatsModel model.
        """

        question_reviewer_stats = list(question_reviewer_stats)
        entity_id = reviewer_user_id

        topic_ids = (
            [v.topic_id for v in question_reviewer_stats])
        reviewed_questions_count = sum(
            v.reviewed_questions_count
                for v in question_reviewer_stats)
        accepted_questions_count = sum(
            v.accepted_questions_count
                for v in question_reviewer_stats)
        accepted_questions_with_reviewer_edits_count = sum(
            v.accepted_questions_with_reviewer_edits_count
                for v in question_reviewer_stats)
        rejected_questions_count = (
            reviewed_questions_count - accepted_questions_count
        )
        first_contribution_date = min(
            (v.first_contribution_date for v in question_reviewer_stats))
        last_contribution_date = max(
            (v.last_contribution_date for v in question_reviewer_stats))

        with datastore_services.get_ndb_context():
            question_review_stats_models = (
                suggestion_models.QuestionReviewerTotalContributionStatsModel( # pylint: disable=line-too-long
                id=entity_id,
                contributor_id=reviewer_user_id,
                topic_ids_with_question_reviews=topic_ids,
                reviewed_questions_count=reviewed_questions_count,
                accepted_questions_count=accepted_questions_count,
                accepted_questions_with_reviewer_edits_count=(
                    accepted_questions_with_reviewer_edits_count),
                rejected_questions_count=rejected_questions_count,
                first_contribution_date=first_contribution_date,
                last_contribution_date=last_contribution_date
                )
            )
            question_review_stats_models.update_timestamps()
            return question_review_stats_models

    @staticmethod
    def not_validate_topic(topic_id: str) -> bool:
        """Validates if there exist a topic with a given topic ID.

        Args:
            topic_id: str. The id of the topic that needs to be validated.

        Returns:
            bool. True if topic doesn't exist and False if topic exists.
        """
        with datastore_services.get_ndb_context():
            topic = topic_fetchers.get_topic_by_id(topic_id, strict=False)

        if topic is None:
            return True

        return False


class AuditGenerateContributorAdminStatsJob(
    GenerateContributorAdminStatsJob
):
    """Audit Job for GenerateContributorAdminStatsJob
    """

    DATASTORE_UPDATES_ALLOWED = False


class AuditAndLogIncorretDataInContributorAdminStatsJob(base_jobs.JobBase):
    """Job that finds the suggestion models for which stats models are missing
    and log them as job run results. Also then verify whether there are
    opportunity models for these suggestions and log them along with the
    suggestion model.
    """

    DATASTORE_UPDATES_ALLOWED = False

    def run(self) -> beam.PCollection[job_run_result.JobRunResult]:
        """Return the suggestion models for which stats models are missing
        contribution stats models along with a boolean field, showing the
        existence of corresponding opportunity model

        Returns:
            PCollection. A PCollection of 'SUCCESS x' results, where x is
            the number of suggestion models for which stats models are missing
            and such suggestion models with a boolean field showing the
            existence of corresponding opportunity model.
        """

        general_suggestions_models = (
            self.pipeline
            | 'Get non-deleted GeneralSuggestionModel' >> ndb_io.GetModels(
                suggestion_models.GeneralSuggestionModel.get_all(
                    include_deleted=False))
        )

        translation_general_suggestions_stats = (
            general_suggestions_models
             | 'Filter reviewed translate suggestions' >> beam.Filter(
                lambda m: (
                    m.suggestion_type ==
                    feconf.SUGGESTION_TYPE_TRANSLATE_CONTENT
                ))
            | 'Group by language and user' >> beam.Map(
                lambda stats: ((stats.language_code, stats.author_id), stats)
            )
        )

        question_general_suggestions_stats = (
            general_suggestions_models
             | 'Filter reviewed questions suggestions' >> beam.Filter(
                lambda m: (
                    m.suggestion_type ==
                    feconf.SUGGESTION_TYPE_ADD_QUESTION
                ))
            | 'Group by user' >> beam.Map(
                lambda stats: (stats.author_id, stats)
            )
        )

        translation_contribution_stats = (
            self.pipeline
            | 'Get all non-deleted TranslationContributionStatsModel models' >>
                ndb_io.GetModels(
                suggestion_models.TranslationContributionStatsModel.get_all(
                    include_deleted=False))
            | 'Filter translation contribution with no topic' >> beam.Filter(
                lambda m: m.topic_id != '')
            | 'Group TranslationContributionStatsModel by language and contributor' # pylint: disable=line-too-long
                >> beam.Map(
                lambda stats: (
                    (stats.language_code, stats.contributor_user_id), stats
                )
            )
        )

        question_contribution_stats = (
            self.pipeline
            | 'Get all non-deleted QuestionContributionStatsModel models' >>
                ndb_io.GetModels(
                suggestion_models.QuestionContributionStatsModel.get_all(
                    include_deleted=False))
            | 'Group QuestionContributionStatsModel by contributor'
                >> beam.Map(
                lambda stats: (
                    stats.contributor_user_id, stats
                )
            )
        )

        translation_suggestion_counts_and_logs = (
            {
                'translation_contribution_stats':
                    translation_contribution_stats,
                'translation_general_suggestions_stats':
                    translation_general_suggestions_stats
            }
            | 'Merge Translation models' >> beam.CoGroupByKey()
            | 'Get translation suggestion count and logs' >>
                beam.MapTuple(
                    lambda key, value:
                        self.log_translation_contribution(
                            value['translation_contribution_stats'],
                            value['translation_general_suggestions_stats']
                        )
                )
            | 'Filter out None values from translation suggestion' >>
                beam.Filter(lambda x: x is not None)
        )

        translation_suggestion_count_result = (
            translation_suggestion_counts_and_logs
            | 'Unpack translation suggestion counts' >> beam.Map(
                lambda element: element[0])
            | 'Total translation suggestion count' >> beam.CombineGlobally(sum)
            | 'Report translation suggestion count' >> beam.Map(
                lambda result: (
                    job_run_result.JobRunResult.as_stdout(
                        'LOGGED TRANSLATION SUGGESTION COUNT SUCCESS: '
                        f'{result}'
                    )))
        )

        translation_suggestion_logs = (
            translation_suggestion_counts_and_logs
            | 'Unpack translation suggestion logs' >> beam.Map(
                lambda element: (
                    job_run_result.JobRunResult.as_stdout(element[1])
                ))
        )

        question_suggestion_counts_and_logs = (
            {
                'question_contribution_stats':
                    question_contribution_stats,
                'question_general_suggestions_stats':
                    question_general_suggestions_stats
            }
            | 'Merge Question models' >> beam.CoGroupByKey()
            | 'Get question suggestion count and logs' >>
                beam.MapTuple(
                    lambda key, value:
                        self.log_question_contribution(
                            value['question_contribution_stats'],
                            value['question_general_suggestions_stats']
                        )
                )
            | 'Filter out None values from question suggestion' >>
                beam.Filter(lambda x: x is not None)
        )

        question_suggestion_count_result = (
            question_suggestion_counts_and_logs
            | 'Unpack question suggestion counts' >> beam.Map(
                lambda element: element[0])
            | 'Total question suggestion count' >> beam.CombineGlobally(sum)
            | 'Report question suggestion count' >> beam.Map(
                lambda result: (
                    job_run_result.JobRunResult.as_stdout(
                        f'LOGGED QUESTION SUGGESTION COUNT SUCCESS: {result}'
                    )))
        )

        question_suggestion_logs = (
            question_suggestion_counts_and_logs
            | 'Unpack question suggestion logs' >> beam.Map(
                lambda element: (
                    job_run_result.JobRunResult.as_stdout(element[1])
                )
            )
        )

        return (
            (
                translation_suggestion_count_result,
                question_suggestion_count_result,
                translation_suggestion_logs,
                question_suggestion_logs
            )
            | 'Merge job run results' >> beam.Flatten()
        )

    @staticmethod
    def log_translation_contribution(
        translation_contribution_stats:
            Iterable[suggestion_models.TranslationContributionStatsModel],
        translation_general_suggestions_stats:
            Iterable[suggestion_models.GeneralSuggestionModel]) -> Optional[
                Tuple[int, str]]:
        """Returns number and logs of translation suggestion models for which
        translation contribution stats models are missing or invalid, for a
        particular language code and contributor user id

        Args:
            translation_contribution_stats:
                Iterable[suggestion_models.TranslationContributionStatsModel].
                TranslationReviewStatsModel grouped by
                (language_code, contributor_user_id).
            translation_general_suggestions_stats:
                Iterable[suggestion_models.GeneralSuggestionModel].
                TranslationReviewStatsModel grouped by
                (language_code, author_id).

        Returns:
            A 2-tuple (if any) with the following elements:
            - int. The number of suggestion models for which stats models are
            missing or invalid.
            - str. The debug logs, containing information about suggestion
            models for which stats models are missing or invalid.
        """
        translation_contribution_stats = list(translation_contribution_stats)
        valid_topic_ids_with_contribution_stats: List[str] = []
        for stat in translation_contribution_stats:
            if GenerateContributorAdminStatsJob.not_validate_topic(
                stat.topic_id):
                translation_contribution_stats.remove(stat)
            else:
                valid_topic_ids_with_contribution_stats.append(stat.topic_id)

        general_suggestion_models = list(
            translation_general_suggestions_stats)

        debug_logs = '<====TRANSLATION_CONTRIBUTION====>\n'

        logged_suggestions_count = 0

        with datastore_services.get_ndb_context():
            for s in general_suggestion_models:

                story_id = exp_services.get_story_id_linked_to_exploration(
                    s.target_id)
                if story_id is None:
                    logged_suggestions_count += 1
                    debug_logs += (
                        # No exp context model exists.
                        '{\n'
                        f'suggestion_id: {s.id},\n'
                        f'suggestion_type: {s.suggestion_type},\n'
                        f'target_type: {s.target_type},\n'
                        f'traget_id: {s.target_id},\n'
                        'target_verion_at_submission: '
                        f'{s.target_version_at_submission},\n'
                        f'status: {s.status},\n'
                        f'language_code: {s.language_code},\n'
                        'corresponding_topic_id: [\n{'
                        f'topic_id: None, '
                        'problem: no_exp_context_model},\n],\n')

                    # Check if xploration opportunity model exists.
                    opportunity_model_exists = (
                        opportunity_models
                            .ExplorationOpportunitySummaryModel
                                .get_by_id(
                                    s.target_id) is not (
                                        None)
                    )
                    debug_logs += (
                        'exp_opportunity_model_exists: '
                        f'{opportunity_model_exists},\n'
                        '},\n'
                    )
                else:
                    story = story_fetchers.get_story_by_id(story_id)
                    topic_id = story.corresponding_topic_id
                    if topic_id not in (
                        valid_topic_ids_with_contribution_stats):
                        # Valid stats model does not exists.
                        logged_suggestions_count += 1
                        debug_logs += (
                            '{\n'
                            f'suggestion_id: {s.id},\n'
                            f'suggestion_type: {s.suggestion_type},\n'
                            f'target_type: {s.target_type},\n'
                            f'traget_id: {s.target_id},\n'
                            'target_verion_at_submission: '
                            f'{s.target_version_at_submission},\n'
                            f'status: {s.status},\n'
                            f'language_code: {s.language_code},\n'
                            'corresponding_topic_id: [\n{'
                            f'topic_id: {topic_id}, '
                            'problem: no_stats_model},\n],\n')

                        # Check if xploration opportunity model exists.
                        opportunity_model_exists = (
                            opportunity_models
                                .ExplorationOpportunitySummaryModel
                                    .get_by_id(
                                        s.target_id) is not (
                                            None)
                        )
                        debug_logs += (
                            'exp_opportunity_model_exists: '
                            f'{opportunity_model_exists},\n'
                            '},\n'
                        )

        if logged_suggestions_count == 0:
            return None
        else:
            return (logged_suggestions_count, debug_logs)

    @staticmethod
    def log_question_contribution(
        question_contribution_stats:
            Iterable[suggestion_models.QuestionContributionStatsModel],
        question_general_suggestions_stats:
            Iterable[suggestion_models.GeneralSuggestionModel]) -> Optional[
                Tuple[int, str]]:
        """Returns number and logs of questions suggestion models for which
        quesion contribution stats models are missing or invalid, for a
        particular contributor user id

        Args:
            question_contribution_stats:
                Iterable[suggestion_models.QuestionContributionStatsModel].
                QuestionContributionStatsModel grouped by
                contributor_user_id.
            question_general_suggestions_stats:
                Iterable[suggestion_models.GeneralSuggestionModel].
                GeneralSuggestionModel grouped by author_id.

        Returns:
            A 2-tuple (if any) with the following elements:
            - int. The number of suggestion models for which stats models are
            missing or invalid.
            - str. The debug logs, containing information about suggestion
            models for which stats models are missing or invalid.
        """
        question_contribution_stats = list(question_contribution_stats)
        valid_topic_ids_with_contribution_stats: List[str] = []
        for stat in question_contribution_stats:
            if GenerateContributorAdminStatsJob.not_validate_topic(
                stat.topic_id):
                question_contribution_stats.remove(stat)
            else:
                valid_topic_ids_with_contribution_stats.append(stat.topic_id)

        general_suggestion_stats = list(
            question_general_suggestions_stats)

        debug_logs = '<====QUESTION_CONTRIBUTION====>\n'

        logged_suggestions_count = 0

        with datastore_services.get_ndb_context():
            for s in general_suggestion_stats:
                topic_assignments = list(
                    skill_services.get_all_topic_assignments_for_skill(
                        s.target_id))
                for t in topic_assignments:
                    if t.topic_id not in (
                        valid_topic_ids_with_contribution_stats):
                        # Valid stats model does not exists.
                        logged_suggestions_count += 1
                        debug_logs += (
                            '{\n'
                            f'suggestion_id: {s.id},\n'
                            f'suggestion_type: {s.suggestion_type},\n'
                            f'target_type: {s.target_type},\n'
                            f'traget_id: {s.target_id},\n'
                            'target_verion_at_submission: '
                            f'{s.target_version_at_submission},\n'
                            f'status: {s.status},\n'
                            'corresponding_topic_id: [\n{'
                            f'topic_id: {t.topic_id}, '
                            'problem: no_stats_model},\n],\n')

                        # Check if xploration opportunity model exists.
                        opportunity_model_exists = (
                            opportunity_models.SkillOpportunityModel
                                .get_by_id(s.target_id) is not None
                        )

                        debug_logs += (
                            'skill_opportunity_model_exists: '
                            f'{opportunity_model_exists},\n'
                            '},\n'
                        )

        if logged_suggestions_count == 0:
            return None
        else:
            return (logged_suggestions_count, debug_logs)
