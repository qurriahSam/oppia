// Copyright 2015 The Oppia Authors. All Rights Reserved.
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
 * @fileoverview Service to send changes to a collection to the backend.
 */

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';

import {
  Collection,
  CollectionBackendDict,
} from 'domain/collection/collection.model';
import {CollectionEditorPageConstants} from 'pages/collection-editor-page/collection-editor-page.constants';
import {ReadOnlyCollectionBackendApiService} from 'domain/collection/read-only-collection-backend-api.service';
import {UrlInterpolationService} from 'domain/utilities/url-interpolation.service';
import {BackendChangeObject} from 'domain/editor/undo_redo/change.model';

interface EditableCollectionBackendResponse {
  collection: CollectionBackendDict;
}

// TODO(bhenning): I think that this might be better merged with the
// CollectionBackendApiService. However, that violates the principle of a
// backend API service being available for exactly one URL. To fix this, the
// backend controller could support both get and put and be pulled out of the
// collection learner and moved into its own controller. This is a new pattern
// for the backend, but it makes sense based on the usage of the get HTTP
// request by both the learner and editor views. This would result in one
// backend controller (file and class) for handling retrieving and changing
// collection data, as well as one frontend service for interfacing with it.
// Discuss and decide whether this is a good approach and then remove this TODO
// after deciding and acting upon the decision (which would mean implementing
// it if it's agreed upon).
@Injectable({
  providedIn: 'root',
})
export class EditableCollectionBackendApiService {
  constructor(
    private http: HttpClient,
    private readOnlyCollectionService: ReadOnlyCollectionBackendApiService,
    private urlInterpolationService: UrlInterpolationService
  ) {}

  private _fetchCollection(
    collectionId: string,
    successCallback: (value: Collection) => void,
    errorCallback: (reason: string) => void
  ): void {
    var collectionDataUrl = this.urlInterpolationService.interpolateUrl(
      CollectionEditorPageConstants.EDITABLE_COLLECTION_DATA_URL_TEMPLATE,
      {
        collection_id: collectionId,
      }
    );

    this.http
      .get<EditableCollectionBackendResponse>(collectionDataUrl)
      .toPromise()
      .then(
        response => {
          var collectionObject = Collection.create(response.collection);
          if (successCallback) {
            successCallback(collectionObject);
          }
        },
        errorResponse => {
          if (errorCallback) {
            errorCallback(errorResponse.error.error);
          }
        }
      );
  }

  private _updateCollection(
    collectionId: string,
    collectionVersion: number,
    commitMessage: string,
    changeList: BackendChangeObject[],
    successCallback: (value: Collection) => void,
    errorCallback: (reason: string) => void
  ): void {
    var editableCollectionDataUrl = this.urlInterpolationService.interpolateUrl(
      CollectionEditorPageConstants.EDITABLE_COLLECTION_DATA_URL_TEMPLATE,
      {
        collection_id: collectionId,
      }
    );

    var putData = {
      version: collectionVersion,
      commit_message: commitMessage,
      change_list: changeList,
    };
    this.http
      .put<EditableCollectionBackendResponse>(
        editableCollectionDataUrl,
        putData
      )
      .toPromise()
      .then(
        response => {
          // The returned data is an updated collection dict.
          var collectionObject = Collection.create(response.collection);

          // Update the ReadOnlyCollectionBackendApiService's cache with the new
          // collection.
          this.readOnlyCollectionService.cacheCollection(
            collectionId,
            collectionObject
          );

          if (successCallback) {
            successCallback(collectionObject);
          }
        },
        errorResponse => {
          if (errorCallback) {
            errorCallback(errorResponse.error.error);
          }
        }
      );
  }

  async fetchCollectionAsync(collectionId: string): Promise<Collection> {
    return new Promise((resolve, reject) => {
      this._fetchCollection(collectionId, resolve, reject);
    });
  }

  /**
   * Updates a collection in the backend with the provided collection ID.
   * The changes only apply to the collection of the given version and the
   * request to update the collection will fail if the provided collection
   * version is older than the current version stored in the backend. Both
   * the changes and the message to associate with those changes are used
   * to commit a change to the collection. The new collection is passed to
   * the success callback, if one is provided to the returned promise
   * object. Errors are passed to the error callback, if one is provided.
   * Finally, if the update is successful, the returned collection will be
   * cached within the CollectionBackendApiService to ensure the cache is
   * not out-of-date with any updates made by this backend API service.
   */
  async updateCollectionAsync(
    collectionId: string,
    collectionVersion: number,
    commitMessage: string,
    changeList: BackendChangeObject[]
  ): Promise<Collection> {
    return new Promise((resolve, reject) => {
      this._updateCollection(
        collectionId,
        collectionVersion,
        commitMessage,
        changeList,
        resolve,
        reject
      );
    });
  }
}
