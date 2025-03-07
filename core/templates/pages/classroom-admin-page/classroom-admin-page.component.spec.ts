// Copyright 2022 The Oppia Authors. All Rights Reserved.
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
 * @fileoverview Tests for the classroom admin component.
 */

import {HttpClientTestingModule} from '@angular/common/http/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NgbModal, NgbModalRef} from '@ng-bootstrap/ng-bootstrap';
import {ContextService} from 'services/context.service';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {EditableTopicBackendApiService} from 'domain/topic/editable-topic-backend-api.service';
import {ClassroomAdminPageComponent} from 'pages/classroom-admin-page/classroom-admin-page.component';
import {ClassroomBackendApiService} from '../../domain/classroom/classroom-backend-api.service';
import {AlertsService} from 'services/alerts.service';
import {ExistingClassroomData} from './existing-classroom.model';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MaterialModule} from 'modules/material.module';
import {MockTranslatePipe} from 'tests/unit-test-utils';
import {CdkDragDrop} from '@angular/cdk/drag-drop';
import cloneDeep from 'lodash/cloneDeep';
import {UpdateClassroomsOrderModalComponent} from './modals/update-classrooms-order-modal.component';

class MockNgbModal {
  open() {
    return {
      result: Promise.resolve(),
    };
  }
}

const dummyThumbnailData = {
  filename: 'thumbnail.svg',
  bg_color: 'transparent',
  size_in_bytes: 1000,
  image_data: new Blob([''], {type: 'image/svg+xml'}),
};

const dummyBannerData = {
  filename: 'banner.png',
  bg_color: 'transparent',
  size_in_bytes: 1000,
  image_data: new Blob([''], {type: 'image/png'}),
};

let dummyClassroomDict = {
  classroomId: 'classroomId',
  name: 'math',
  urlFragment: 'math',
  courseDetails: "Oppia's curated maths lesson.",
  teaserText: 'Learn math',
  topicListIntro: 'Start from the basics with our first topic.',
  topicIdToPrerequisiteTopicIds: {},
  isPublished: true,
  diagnosticTestIsEnabled: false,
  thumbnailData: dummyThumbnailData,
  bannerData: dummyBannerData,
};

let dummyTopicToClassroomRelations = [
  {
    topic_id: 'topicid1',
    topic_name: 'topic1',
    classroom_name: 'math',
    classroom_url_fragment: 'math',
  },
  {
    topic_id: 'topicid2',
    topic_name: 'topic2',
    classroom_name: null,
    classroom_url_fragment: null,
  },
  {
    topic_id: 'topicid3',
    topic_name: 'topic3',
    classroom_name: null,
    classroom_url_fragment: null,
  },
];

describe('Classroom Admin Page component ', () => {
  let component: ClassroomAdminPageComponent;
  let fixture: ComponentFixture<ClassroomAdminPageComponent>;
  let contextService: ContextService;
  let classroomBackendApiService: ClassroomBackendApiService;
  let editableTopicBackendApiService: EditableTopicBackendApiService;
  let ngbModal: NgbModal;
  let alertsService: AlertsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        BrowserAnimationsModule,
        MaterialModule,
        FormsModule,
        MatAutocompleteModule,
        ReactiveFormsModule,
      ],
      declarations: [ClassroomAdminPageComponent, MockTranslatePipe],
      providers: [
        AlertsService,
        ContextService,
        ClassroomBackendApiService,
        EditableTopicBackendApiService,
        {
          provide: NgbModal,
          useClass: MockNgbModal,
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(ClassroomAdminPageComponent);
    contextService = TestBed.inject(ContextService);
    component = fixture.componentInstance;
  });

  beforeEach(() => {
    classroomBackendApiService = TestBed.inject(ClassroomBackendApiService);
    editableTopicBackendApiService = TestBed.inject(
      EditableTopicBackendApiService
    );
    ngbModal = TestBed.inject(NgbModal);
    alertsService = TestBed.inject(AlertsService);
  });

  it('should initialize the component', fakeAsync(() => {
    let response = [
      {
        classroom_id: 'math_classroom_id',
        classroom_name: 'math',
        classroom_index: 1,
      },
      {
        classroom_id: 'physics_classroom_id',
        classroom_name: 'physics',
        classroom_index: 2,
      },
    ];

    spyOn(
      classroomBackendApiService,
      'getAllClassroomDisplayInfoDictAsync'
    ).and.returnValue(Promise.resolve(response));

    expect(component.pageIsInitialized).toBeFalse();

    component.ngOnInit();
    tick();

    expect(component.pageIsInitialized).toBeTrue();
    expect(component.classroomIdToClassroomNameIndex).toEqual(response);
    expect(component.classroomCount).toEqual(2);
  }));

  it('should open classroom detail and update classroom properties', fakeAsync(() => {
    let response = {
      classroomDict: dummyClassroomDict,
    };
    spyOn(classroomBackendApiService, 'getClassroomDataAsync').and.returnValue(
      Promise.resolve(response)
    );

    expect(component.classroomViewerMode).toBeFalse();
    expect(component.classroomDetailsIsShown).toBeFalse();
    component.ngOnInit();

    component.getClassroomData('classroomId');
    tick();

    expect(component.classroomViewerMode).toBeTrue();
    expect(component.classroomDetailsIsShown).toBeTrue();
  }));

  it('should display alert when unable to fetch classroom data', fakeAsync(() => {
    spyOn(classroomBackendApiService, 'getClassroomDataAsync').and.returnValue(
      Promise.reject(400)
    );
    spyOn(alertsService, 'addWarning');

    component.getClassroomData('classroomId');
    tick();

    expect(classroomBackendApiService.getClassroomDataAsync).toHaveBeenCalled();
    expect(alertsService.addWarning).toHaveBeenCalledWith(
      'Failed to get classroom data'
    );
  }));

  it('should display alert when unable to fetch topics to classroom relation', fakeAsync(() => {
    spyOn(
      classroomBackendApiService,
      'getAllTopicsToClassroomRelation'
    ).and.returnValue(Promise.reject(400));
    spyOn(alertsService, 'addWarning');

    component.getAllTopicsToClassroomRelation();
    tick();

    expect(
      classroomBackendApiService.getAllTopicsToClassroomRelation
    ).toHaveBeenCalled();
    expect(alertsService.addWarning).toHaveBeenCalledWith(
      'Failed to get topics and classrooms relation'
    );
  }));

  it('should close classroom details when already in view mode', fakeAsync(() => {
    let response = {
      classroomDict: dummyClassroomDict,
    };
    spyOn(classroomBackendApiService, 'getClassroomDataAsync').and.returnValue(
      Promise.resolve(response)
    );
    component.classroomViewerMode = true;
    component.classroomDetailsIsShown = true;

    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );

    component.getClassroomData('classroomId');
    tick();

    expect(component.classroomDetailsIsShown).toBeFalse();
    expect(component.classroomViewerMode).toBeFalse();
  }));

  it('should set topicsToClassroomRelation and filteredTopicsToClassroomRelation', fakeAsync(() => {
    const response = [
      {
        topic_name: 'topic_name',
        topic_id: 'topic_id',
        classroom_name: null,
        classroom_url_fragment: null,
      },
    ];
    spyOn(
      classroomBackendApiService,
      'getAllTopicsToClassroomRelation'
    ).and.returnValue(Promise.resolve(response));

    expect(component.topicsToClassroomRelation.length).toEqual(0);
    expect(component.filteredTopicsToClassroomRelation.length).toEqual(0);

    component.getClassroomData('getAllTopicsToClassroomRelation');
    tick();

    expect(component.topicsToClassroomRelation.length).toEqual(1);
    expect(component.filteredTopicsToClassroomRelation.length).toEqual(1);
  }));

  it('should get available topics which we can assign to a classroom', fakeAsync(() => {
    component.topicsToClassroomRelation = dummyTopicToClassroomRelations;

    const availableTopics = component.getAvailableTopics();
    tick();

    expect(availableTopics.length).toEqual(2);
  }));

  it('should filter topics by topic name', fakeAsync(() => {
    component.topicsToClassroomRelation = dummyTopicToClassroomRelations;

    component.filterTopicsByName('topic2');
    expect(component.filteredTopicsToClassroomRelation.length).toEqual(1);

    component.filterTopicsByName('');
    expect(component.filteredTopicsToClassroomRelation.length).toEqual(2);
  }));

  it('should not close classroom details while editing classroom properties', fakeAsync(() => {
    let response = {
      classroomDict: dummyClassroomDict,
    };
    spyOn(classroomBackendApiService, 'getClassroomDataAsync').and.returnValue(
      Promise.resolve(response)
    );

    component.classroomEditorMode = true;
    component.classroomViewerMode = false;
    component.classroomDetailsIsShown = true;

    component.getClassroomData('classroomId');
    tick();

    expect(component.classroomDetailsIsShown).toBeTrue();
    expect(component.classroomEditorMode).toBeTrue();
    expect(component.classroomViewerMode).toBeFalse();
  }));

  it('should get classroom ID to classroom name and update classroom count', fakeAsync(() => {
    let response = [
      {
        classroom_id: 'math_classroom_id',
        classroom_name: 'math',
        classroom_index: 1,
      },
      {
        classroom_id: 'physics_classroom_id',
        classroom_name: 'physics',
        classroom_index: 2,
      },
    ];
    spyOn(
      classroomBackendApiService,
      'getAllClassroomDisplayInfoDictAsync'
    ).and.returnValue(Promise.resolve(response));

    expect(component.pageIsInitialized).toBeFalse();

    component.getAllClassroomIdToClassroomNameIndex();
    tick();

    expect(component.pageIsInitialized).toBeTrue();
    expect(component.classroomIdToClassroomNameIndex).toEqual(response);
    expect(component.classroomCount).toEqual(2);
  }));

  it('should be able to update the classroom name', () => {
    const response = {
      classroomDict: dummyClassroomDict,
    };
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.classroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.tempClassroomData.setClassroomName('Discrete maths');
    component.classroomDataIsChanged = false;

    component.updateClassroomField();

    expect(component.classroomDataIsChanged).toBeTrue();
  });

  it('should be able to update the classroom teaser text', () => {
    const response = {
      classroomDict: dummyClassroomDict,
    };
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.classroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.tempClassroomData.setTeaserText('Learn math updated');
    component.classroomDataIsChanged = false;

    component.updateClassroomField();

    expect(component.classroomDataIsChanged).toBeTrue();
  });

  it('should be able to update the classroom thumbnail and banner data', () => {
    const response = {
      classroomDict: dummyClassroomDict,
    };
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.classroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.updateThumbnailData({
      ...dummyThumbnailData,
      filename: 'updated.svg',
    });
    component.updateBannerData({
      ...dummyBannerData,
      filename: 'updated.png',
    });
    component.classroomDataIsChanged = false;

    component.updateClassroomField();

    expect(component.classroomDataIsChanged).toBeTrue();
  });

  it(
    'should not update the classroom field if the current changes match ' +
      'with existing ones',
    () => {
      const response = {
        classroomDict: dummyClassroomDict,
      };
      component.tempClassroomData =
        ExistingClassroomData.createClassroomFromDict(response.classroomDict);
      component.classroomData = ExistingClassroomData.createClassroomFromDict(
        response.classroomDict
      );
      component.tempClassroomData.setClassroomName('Discrete maths');
      component.classroomDataIsChanged = false;

      component.updateClassroomField();

      expect(component.classroomDataIsChanged).toBeTrue();

      component.tempClassroomData.setClassroomName('math');

      component.updateClassroomField();

      expect(component.classroomDataIsChanged).toBeFalse();
    }
  );

  it('should be able to update the classroom url fragment', () => {
    let response = {
      classroomDict: dummyClassroomDict,
    };
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.classroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.tempClassroomData.setUrlFragment('newMathUrl');
    component.classroomDataIsChanged = false;

    component.updateClassroomField();

    expect(component.classroomDataIsChanged).toBeTrue();
  });

  it('should be able to update the classroom course details', () => {
    let response = {
      classroomDict: dummyClassroomDict,
    };
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.classroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.tempClassroomData.setCourseDetails(
      "Oppia's curated maths lesson updated."
    );
    component.classroomDataIsChanged = false;

    component.updateClassroomField();

    expect(component.classroomDataIsChanged).toBeTrue();
  });

  it('should be able to update the classroom topic list intro', () => {
    let response = {
      classroomDict: dummyClassroomDict,
    };
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.classroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.tempClassroomData.setTopicListIntro(
      'Start from the basics with our first topic updated.'
    );
    component.classroomDataIsChanged = false;

    component.updateClassroomField();

    expect(component.classroomDataIsChanged).toBeTrue();
  });

  it('should be able to convert classroom dict to the backend form', () => {
    let classroomBackendDict = {
      classroom_id: 'classroomId',
      name: 'math',
      url_fragment: 'math',
      course_details: "Oppia's curated maths lesson.",
      teaser_text: 'Learn math',
      topic_list_intro: 'Start from the basics with our first topic.',
      topic_id_to_prerequisite_topic_ids: {},
      is_published: true,
      diagnostic_test_is_enabled: false,
      thumbnail_data: dummyThumbnailData,
      banner_data: dummyBannerData,
    };
    let classroomDict = {
      classroomId: 'classroomId',
      name: 'math',
      urlFragment: 'math',
      courseDetails: "Oppia's curated maths lesson.",
      teaserText: 'Learn math',
      topicListIntro: 'Start from the basics with our first topic.',
      topicIdToPrerequisiteTopicIds: {},
      isPublished: true,
      diagnosticTestIsEnabled: false,
      thumbnailData: dummyThumbnailData,
      bannerData: dummyBannerData,
    };
    expect(component.convertClassroomDictToBackendForm(classroomDict)).toEqual(
      classroomBackendDict
    );
  });

  it('should be able to close classroom viewer and open classroom editor', () => {
    component.classroomViewerMode = true;
    component.classroomEditorMode = false;

    component.openClassroomInEditorMode();

    expect(component.classroomViewerMode).toBeFalse();
    expect(component.classroomEditorMode).toBeTrue();
  });

  it('should be able to save classroom data', fakeAsync(() => {
    component.classroomViewerMode = false;
    component.classroomEditorMode = true;
    component.classroomDataIsChanged = true;
    component.classroomIdToClassroomNameIndex = [];
    component.tempClassroomData =
      ExistingClassroomData.createClassroomFromDict(dummyClassroomDict);
    component.classroomData =
      ExistingClassroomData.createClassroomFromDict(dummyClassroomDict);

    spyOn(
      classroomBackendApiService,
      'updateClassroomDataAsync'
    ).and.returnValue(Promise.resolve());

    component.saveClassroomData('classroomId');
    tick();

    expect(component.classroomViewerMode).toBeTrue();
    expect(component.classroomEditorMode).toBeFalse();
    expect(component.classroomDataIsChanged).toBeFalse();
  }));

  it('should be able handle rejection handler while saving classroom data', fakeAsync(() => {
    component.tempClassroomData =
      ExistingClassroomData.createClassroomFromDict(dummyClassroomDict);
    component.classroomData =
      ExistingClassroomData.createClassroomFromDict(dummyClassroomDict);

    spyOn(
      classroomBackendApiService,
      'updateClassroomDataAsync'
    ).and.returnValue(Promise.reject());

    component.tempClassroomData.setClassroomName('Discrete maths');

    component.saveClassroomData('classroomId');
    tick();

    expect(component.tempClassroomData).toEqual(component.classroomData);
  }));

  it(
    'should present a confirmation modal before exiting editor mode if ' +
      'any classroom propeties are already modified',
    fakeAsync(() => {
      component.classroomDataIsChanged = true;
      component.classroomEditorMode = true;
      component.classroomViewerMode = false;
      component.classroomData = ExistingClassroomData.createClassroomFromDict({
        classroomId: 'classroomId',
        name: 'math',
        urlFragment: 'math',
        courseDetails: "Oppia's curated maths lesson.",
        teaserText: 'Learn math',
        topicListIntro: 'Start from the basics with our first topic.',
        topicIdToPrerequisiteTopicIds: {},
        isPublished: true,
        diagnosticTestIsEnabled: false,
        thumbnailData: dummyThumbnailData,
        bannerData: dummyBannerData,
      });
      spyOn(ngbModal, 'open').and.returnValue({
        componentInstance: {},
        result: Promise.resolve(),
      } as NgbModalRef);

      component.closeClassroomConfigEditor();
      tick();

      expect(ngbModal.open).toHaveBeenCalled();
      expect(component.classroomEditorMode).toBeFalse();
      expect(component.classroomViewerMode).toBeTrue();
      expect(component.classroomDataIsChanged).toBeFalse();
    })
  );

  it(
    'should be able to cancel the exit editor confirmation modal and ' +
      'continue editing',
    () => {
      component.classroomDataIsChanged = true;
      component.classroomEditorMode = true;
      component.classroomViewerMode = false;
      spyOn(ngbModal, 'open').and.returnValue({
        componentInstance: {},
        result: Promise.reject(),
      } as NgbModalRef);

      component.closeClassroomConfigEditor();

      expect(ngbModal.open).toHaveBeenCalled();
      expect(component.classroomDataIsChanged).toBeTrue();
      expect(component.classroomEditorMode).toBeTrue();
      expect(component.classroomViewerMode).toBeFalse();
    }
  );

  it(
    'should not present a confirmation modal if none of the classroom ' +
      'properties were updated',
    () => {
      component.classroomDataIsChanged = false;
      component.classroomEditorMode = true;
      component.classroomViewerMode = false;
      spyOn(ngbModal, 'open').and.returnValue({
        componentInstance: {},
        result: Promise.resolve(),
      } as NgbModalRef);

      component.closeClassroomConfigEditor();

      expect(ngbModal.open).not.toHaveBeenCalled();
      expect(component.classroomEditorMode).toBeFalse();
      expect(component.classroomViewerMode).toBeTrue();
    }
  );

  it('should be able to delete classroom', fakeAsync(() => {
    const response = [
      {
        classroom_name: 'math',
        classroom_id: 'mathClassroomId',
        classroom_index: 0,
      },
      {
        classroom_name: 'chemistry',
        classroom_id: 'chemistryClassroomId',
        classroom_index: 1,
      },
      {
        classroom_name: 'physics',
        classroom_id: 'physicsClassroomId',
        classroom_index: 2,
      },
    ];

    spyOn(
      classroomBackendApiService,
      'getAllClassroomDisplayInfoDictAsync'
    ).and.returnValue(Promise.resolve(response));

    component.ngOnInit();
    tick();

    component.classroomCount = 3;
    spyOn(ngbModal, 'open').and.returnValue({
      componentInstance: {},
      result: Promise.resolve(),
    } as NgbModalRef);
    spyOn(classroomBackendApiService, 'deleteClassroomAsync').and.returnValue(
      Promise.resolve()
    );
    component.deleteClassroom('chemistryClassroomId');
    tick();

    expect(ngbModal.open).toHaveBeenCalled();
    expect(component.classroomCount).toEqual(2);
  }));

  it('should be able to cancel modal for not deleting the classroom', fakeAsync(() => {
    component.classroomIdToClassroomNameIndex = [
      {
        classroom_name: 'math',
        classroom_id: 'mathClassroomId',
        classroom_index: 0,
      },
      {
        classroom_name: 'chemistry',
        classroom_id: 'chemistryClassroomId',
        classroom_index: 1,
      },
      {
        classroom_name: 'physics',
        classroom_id: 'physicsClassroomId',
        classroom_index: 2,
      },
    ];
    let expectedClassroomIdToName = [
      {
        classroom_name: 'math',
        classroom_id: 'mathClassroomId',
        classroom_index: 0,
      },
      {
        classroom_name: 'chemistry',
        classroom_id: 'chemistryClassroomId',
        classroom_index: 1,
      },
      {
        classroom_name: 'physics',
        classroom_id: 'physicsClassroomId',
        classroom_index: 2,
      },
    ];
    component.classroomCount = 3;
    spyOn(ngbModal, 'open').and.returnValue({
      componentInstance: {},
      result: Promise.reject(),
    } as NgbModalRef);
    spyOn(classroomBackendApiService, 'deleteClassroomAsync').and.returnValue(
      Promise.resolve()
    );

    component.deleteClassroom('mathClassroomId');
    tick();

    expect(ngbModal.open).toHaveBeenCalled();
    expect(component.classroomIdToClassroomNameIndex).toEqual(
      expectedClassroomIdToName
    );
    expect(component.classroomCount).toEqual(3);
  }));

  it('should be able to create new classroom', fakeAsync(() => {
    component.classroomIdToClassroomNameIndex = [
      {
        classroom_name: 'math',
        classroom_id: 'mathClassroomId',
        classroom_index: 0,
      },
      {
        classroom_name: 'chemistry',
        classroom_id: 'chemistryClassroomId',
        classroom_index: 2,
      },
    ];
    let expectedClassroomIdToName = [
      {
        classroom_name: 'math',
        classroom_id: 'mathClassroomId',
        classroom_index: 0,
      },
      {
        classroom_name: 'chemistry',
        classroom_id: 'chemistryClassroomId',
        classroom_index: 2,
      },
      {
        classroom_name: 'physics',
        classroom_id: 'physicsClassroomId',
        classroom_index: 2,
      },
    ];
    let classroomDict = {
      classroom_id: 'physicsClassroomId',
      name: 'physics',
      url_fragment: '',
      course_details: '',
      topic_list_intro: '',
      topic_id_to_prerequisite_topic_ids: {},
    };
    spyOn(ngbModal, 'open').and.returnValue({
      componentInstance: {
        existingClassroomNames: ['math', 'chemistry'],
      },
      result: Promise.resolve(classroomDict),
    } as NgbModalRef);

    component.createNewClassroom();
    tick();

    expect(ngbModal.open).toHaveBeenCalled();
    expect(component.classroomIdToClassroomNameIndex).toEqual(
      expectedClassroomIdToName
    );
  }));

  it('should be able to cancel create classsroom modal', fakeAsync(() => {
    component.classroomIdToClassroomNameIndex = [
      {
        classroom_name: 'math',
        classroom_id: 'mathClassroomId',
        classroom_index: 0,
      },
      {
        classroom_name: 'chemistry',
        classroom_id: 'chemistryClassroomId',
        classroom_index: 2,
      },
    ];
    let expectedClassroomIdToName = [
      {
        classroom_name: 'math',
        classroom_id: 'mathClassroomId',
        classroom_index: 0,
      },
      {
        classroom_name: 'chemistry',
        classroom_id: 'chemistryClassroomId',
        classroom_index: 2,
      },
    ];

    spyOn(ngbModal, 'open').and.returnValue({
      componentInstance: {
        existingClassroomNames: ['math', 'chemistry'],
      },
      result: Promise.reject(),
    } as NgbModalRef);

    component.createNewClassroom();
    tick();

    expect(ngbModal.open).toHaveBeenCalled();
    expect(component.classroomIdToClassroomNameIndex).toEqual(
      expectedClassroomIdToName
    );
  }));

  it('should convert the topic dependencies from topic ID form to topic name', fakeAsync(() => {
    const topicIdTotopicName = {
      topicId1: 'Dummy topic 1',
      topicId2: 'Dummy topic 2',
      topicId3: 'Dummy topic 3',
    };
    const topicIdToPrerequisiteTopicIds = {
      topicId1: [],
      topicId2: ['topicId1'],
      topicId3: ['topicId1'],
    };
    const topicNameToPrerequisiteTopicNames = {
      'Dummy topic 1': [],
      'Dummy topic 2': ['Dummy topic 1'],
      'Dummy topic 3': ['Dummy topic 1'],
    };

    component.tempClassroomData =
      ExistingClassroomData.createClassroomFromDict(dummyClassroomDict);

    spyOn(
      editableTopicBackendApiService,
      'getTopicIdToTopicNameAsync'
    ).and.returnValue(Promise.resolve(topicIdTotopicName));

    component.setTopicDependencyByTopicName(topicIdToPrerequisiteTopicIds);

    tick();

    expect(component.topicNameToPrerequisiteTopicNames).toEqual(
      topicNameToPrerequisiteTopicNames
    );
  }));

  it('should be able to add new topic ID to classroom', fakeAsync(() => {
    let classroomDict = {
      classroomId: 'classroomId',
      name: 'math',
      urlFragment: 'math',
      courseDetails: "Oppia's curated maths lesson.",
      teaserText: 'Learn math',
      topicListIntro: 'Start from the basics with our first topic.',
      topicIdToPrerequisiteTopicIds: {},
      isPublished: true,
      diagnosticTestIsEnabled: false,
      thumbnailData: dummyThumbnailData,
      bannerData: dummyBannerData,
    };
    component.tempClassroomData =
      ExistingClassroomData.createClassroomFromDict(classroomDict);
    component.classroomData =
      ExistingClassroomData.createClassroomFromDict(classroomDict);
    expect(component.tempClassroomData.getTopicsCount()).toEqual(0);
    expect(
      component.tempClassroomData.getTopicIdToPrerequisiteTopicId()
    ).toEqual({});
    expect(component.topicNameToPrerequisiteTopicNames).toEqual({});
    const topicIdToTopicName = {
      topicId1: 'Dummy topic 1',
    };

    spyOn(
      editableTopicBackendApiService,
      'getTopicIdToTopicNameAsync'
    ).and.returnValue(Promise.resolve(topicIdToTopicName));

    component.onNewTopicInputModelChange('topicId1');

    tick();

    expect(
      component.tempClassroomData.getTopicIdToPrerequisiteTopicId()
    ).toEqual({topicId1: []});
    expect(component.topicNameToPrerequisiteTopicNames).toEqual({
      'Dummy topic 1': [],
    });
    expect(component.tempClassroomData.getTopicsCount()).toEqual(1);
  }));

  it('should be able to show error when new topic ID does not exist', fakeAsync(() => {
    component.topicWithGivenIdExists = true;

    spyOn(
      editableTopicBackendApiService,
      'getTopicIdToTopicNameAsync'
    ).and.returnValue(Promise.reject());

    component.addTopicId('topicId1');

    tick();

    expect(component.topicWithGivenIdExists).toBeFalse();
  }));

  it('should be able to show and remove new topic input field', () => {
    expect(component.newTopicCanBeAdded).toBeFalse();

    component.showNewTopicInputField();

    expect(component.newTopicCanBeAdded).toBeTrue();

    component.removeNewTopicInputField();

    expect(component.newTopicCanBeAdded).toBeFalse();
  });

  it('should remove existing error for topic ID model change', () => {
    component.topicWithGivenIdExists = false;

    component.onNewTopicInputModelChange('DUMMY_ID');

    expect(component.topicWithGivenIdExists).toBeTrue();
  });

  it('should be able to add prerequisite for a topic', () => {
    component.topicIdsToTopicName = {
      topicId1: 'Dummy topic 1',
      topicId2: 'Dummy topic 2',
      topicId3: 'Dummy topic 3',
    };

    component.topicNameToPrerequisiteTopicNames = {
      'Dummy topic 1': [],
      'Dummy topic 2': ['Dummy topic 1'],
      'Dummy topic 3': ['Dummy topic 2'],
    };

    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      {
        ...dummyClassroomDict,
        topicIdToPrerequisiteTopicIds: {
          topicId1: [],
          topicId2: ['topicId1'],
          topicId3: ['topicId2'],
        },
      }
    );
    component.classroomData = cloneDeep(component.tempClassroomData);

    const expectedTopicNameToPrerequisiteTopicNames = {
      'Dummy topic 1': [],
      'Dummy topic 2': ['Dummy topic 1'],
      'Dummy topic 3': ['Dummy topic 1', 'Dummy topic 2'],
    };

    component.addDependencyForTopic('Dummy topic 3', 'Dummy topic 1');

    const expectedTopicIdToPrerequisiteTopicIds = {
      topicId1: [],
      topicId2: ['topicId1'],
      topicId3: ['topicId2', 'topicId1'],
    };

    expect(
      component.tempClassroomData.getTopicIdToPrerequisiteTopicId()
    ).toEqual(expectedTopicIdToPrerequisiteTopicIds);
    expect(component.topicNameToPrerequisiteTopicNames).toEqual(
      expectedTopicNameToPrerequisiteTopicNames
    );
  });

  it('should not add prerequisite that is already added for a topic', () => {
    component.topicIdsToTopicName = {
      topicId1: 'Dummy topic 1',
      topicId2: 'Dummy topic 2',
      topicId3: 'Dummy topic 3',
    };

    component.topicNameToPrerequisiteTopicNames = {
      'Dummy topic 1': [],
      'Dummy topic 2': ['Dummy topic 1'],
      'Dummy topic 3': ['Dummy topic 2'],
    };

    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      {
        ...dummyClassroomDict,
        topicIdToPrerequisiteTopicIds: {
          topicId1: [],
          topicId2: ['topicId1'],
          topicId3: ['topicId2'],
        },
      }
    );
    component.classroomData = cloneDeep(component.tempClassroomData);

    const expectedTopicNameToPrerequisiteTopicNames = {
      'Dummy topic 1': [],
      'Dummy topic 2': ['Dummy topic 1'],
      'Dummy topic 3': ['Dummy topic 2'],
    };

    component.addDependencyForTopic('Dummy topic 3', 'Dummy topic 2');

    const expectedTopicIdToPrerequisiteTopicIds = {
      topicId1: [],
      topicId2: ['topicId1'],
      topicId3: ['topicId2'],
    };

    expect(
      component.tempClassroomData.getTopicIdToPrerequisiteTopicId()
    ).toEqual(expectedTopicIdToPrerequisiteTopicIds);
    expect(component.topicNameToPrerequisiteTopicNames).toEqual(
      expectedTopicNameToPrerequisiteTopicNames
    );
  });

  it('should be able to remove prerequisite from a topic', () => {
    component.topicIdsToTopicName = {
      topicId1: 'Dummy topic 1',
      topicId2: 'Dummy topic 2',
      topicId3: 'Dummy topic 3',
    };

    component.topicNameToPrerequisiteTopicNames = {
      'Dummy topic 1': [],
      'Dummy topic 2': ['Dummy topic 1'],
      'Dummy topic 3': ['Dummy topic 2', 'Dummy topic 1'],
    };

    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      {
        ...dummyClassroomDict,
        topicIdToPrerequisiteTopicIds: {
          topicId1: [],
          topicId2: ['topicId1'],
          topicId3: ['topicId2', 'topicId1'],
        },
      }
    );

    component.classroomData = cloneDeep(component.tempClassroomData);

    component.removeDependencyFromTopic('Dummy topic 3', 'Dummy topic 1');

    const expectedTopicIdToPrerequisiteTopicIds = {
      topicId1: [],
      topicId2: ['topicId1'],
      topicId3: ['topicId2'],
    };
    const expectedTopicNameToPrerequisiteTopicNames = {
      'Dummy topic 1': [],
      'Dummy topic 2': ['Dummy topic 1'],
      'Dummy topic 3': ['Dummy topic 2'],
    };

    expect(
      component.tempClassroomData.getTopicIdToPrerequisiteTopicId()
    ).toEqual(expectedTopicIdToPrerequisiteTopicIds);
    expect(component.topicNameToPrerequisiteTopicNames).toEqual(
      expectedTopicNameToPrerequisiteTopicNames
    );
  });

  it('should be able to get available prerequisite for topic names', () => {
    component.topicNameToPrerequisiteTopicNames = {
      'Dummy topic 1': [],
      'Dummy topic 2': ['Dummy topic 1'],
      'Dummy topic 3': ['Dummy topic 2'],
    };

    component.getEligibleTopicPrerequisites('Dummy topic 2');

    expect(component.eligibleTopicNamesForPrerequisites).toEqual([
      'Dummy topic 3',
    ]);
    expect(component.tempEligibleTopicNamesForPrerequisites).toEqual([
      'Dummy topic 3',
    ]);
  });

  it('should be able to filter prerequisite dropdown as input changes', () => {
    component.eligibleTopicNamesForPrerequisites = ['Dummy topic 1', 'Topic 2'];
    component.tempEligibleTopicNamesForPrerequisites = [
      'Dummy topic 1',
      'Topic 2',
    ];

    component.prerequisiteInput = 'Dummy';
    component.onPrerequisiteInputChange();

    expect(component.tempEligibleTopicNamesForPrerequisites).toEqual([
      'Dummy topic 1',
    ]);

    component.prerequisiteInput = 'Topic';
    component.onPrerequisiteInputChange();

    expect(component.tempEligibleTopicNamesForPrerequisites).toEqual([
      'Topic 2',
    ]);

    component.prerequisiteInput = 'xyz';
    component.onPrerequisiteInputChange();

    expect(component.tempEligibleTopicNamesForPrerequisites).toEqual([]);
  });

  it('should be able to show and remove edit and delete functionality box', () => {
    component.topicDependencyEditOptionIsShown = false;

    component.editDependency('topicName');

    expect(component.topicDependencyEditOptionIsShown).toBeTrue();

    component.editDependency('topicName');

    expect(component.topicDependencyEditOptionIsShown).toBeFalse();
  });

  it('should be able to delete a topic from the classroom on modal confirmation', fakeAsync(() => {
    spyOn(ngbModal, 'open').and.returnValue({
      componentInstance: {},
      result: Promise.resolve(),
    } as NgbModalRef);

    component.topicIdsToTopicName = {
      topicId1: 'Dummy topic 1',
      topicId2: 'Dummy topic 2',
      topicId3: 'Dummy topic 3',
    };

    component.topicNameToPrerequisiteTopicNames = {
      'Dummy topic 1': [],
      'Dummy topic 2': ['Dummy topic 1'],
      'Dummy topic 3': ['Dummy topic 2', 'Dummy topic 1'],
    };

    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      {
        ...dummyClassroomDict,
        topicIdToPrerequisiteTopicIds: {
          topicId1: [],
          topicId2: ['topicId1'],
          topicId3: ['topicId2', 'topicId1'],
        },
      }
    );
    component.classroomData = cloneDeep(component.tempClassroomData);

    component.deleteTopic('Dummy topic 3');

    const expectedTopicIdToPrerequisiteTopicIds = {
      topicId1: [],
      topicId2: ['topicId1'],
    };

    const expectedTopicNameToPrerequisiteTopicNames = {
      'Dummy topic 1': [],
      'Dummy topic 2': ['Dummy topic 1'],
    };

    component.deleteTopic('Dummy topic 3');
    tick();

    expect(
      component.tempClassroomData.getTopicIdToPrerequisiteTopicId()
    ).toEqual(expectedTopicIdToPrerequisiteTopicIds);
    expect(component.topicNameToPrerequisiteTopicNames).toEqual(
      expectedTopicNameToPrerequisiteTopicNames
    );
  }));

  it(
    'should mark the topic dependency flag to false when all topics ' +
      'are deleted',
    fakeAsync(() => {
      spyOn(ngbModal, 'open').and.returnValue({
        componentInstance: {},
        result: Promise.resolve(),
      } as NgbModalRef);

      component.topicIdsToTopicName = {
        topicId1: 'Dummy topic 1',
      };

      component.topicNameToPrerequisiteTopicNames = {
        'Dummy topic 1': [],
      };

      component.tempClassroomData =
        ExistingClassroomData.createClassroomFromDict({
          ...dummyClassroomDict,
          topicIdToPrerequisiteTopicIds: {
            topicId1: [],
          },
        });
      component.classroomData = cloneDeep(component.tempClassroomData);

      component.topicDependencyIsLoaded = true;

      component.deleteTopic('Dummy topic 1');
      tick();

      expect(component.topicIdsToTopicName).toEqual({});
      expect(component.topicDependencyIsLoaded).toBeFalse();
    })
  );

  it('should be able to handle rejection handler on topic deletion modal', fakeAsync(() => {
    spyOn(ngbModal, 'open').and.returnValue({
      componentInstance: {},
      result: Promise.reject(),
    } as NgbModalRef);

    component.topicIdsToTopicName = {
      topicId1: 'Dummy topic 1',
      topicId2: 'Dummy topic 2',
      topicId3: 'Dummy topic 3',
    };

    component.topicNameToPrerequisiteTopicNames = {
      'Dummy topic 1': [],
      'Dummy topic 2': ['Dummy topic 1'],
      'Dummy topic 3': ['Dummy topic 2', 'Dummy topic 1'],
    };

    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      {
        ...dummyClassroomDict,
        topicIdToPrerequisiteTopicIds: {
          topicId1: [],
          topicId2: ['topicId1'],
          topicId3: ['topicId2', 'topicId1'],
        },
      }
    );

    const expectedTopicIdToPrerequisiteTopicIds = {
      topicId1: [],
      topicId2: ['topicId1'],
      topicId3: ['topicId2', 'topicId1'],
    };

    const expectedTopicNameToPrerequisiteTopicNames = {
      'Dummy topic 1': [],
      'Dummy topic 2': ['Dummy topic 1'],
      'Dummy topic 3': ['Dummy topic 2', 'Dummy topic 1'],
    };

    component.deleteTopic('Dummy topic 1');
    tick();

    expect(
      component.tempClassroomData.getTopicIdToPrerequisiteTopicId()
    ).toEqual(expectedTopicIdToPrerequisiteTopicIds);
    expect(component.topicNameToPrerequisiteTopicNames).toEqual(
      expectedTopicNameToPrerequisiteTopicNames
    );
  }));

  it('should change list oder', () => {
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      {
        ...dummyClassroomDict,
        topicIdToPrerequisiteTopicIds: {
          topicId1: [],
          topicId2: ['topicId1'],
          topicId3: ['topicId2', 'topicId1'],
        },
      }
    );
    component.topicIdsToTopicName = {
      topicId1: 'Topic1',
      topicId2: 'Topic2',
      topicId3: 'Topic3',
    };
    component.topicNameToPrerequisiteTopicNames = {
      Topic1: [],
      Topic2: ['Topic1'],
      Topic3: ['Topic2', 'Topic1'],
    };
    component.topicNames = ['Topic1', 'Topic2', 'Topic3'];
    component.classroomData = cloneDeep(component.tempClassroomData);

    spyOn(component.tempClassroomData, 'setTopicIdToPrerequisiteTopicId');

    const event = {
      previousIndex: 1,
      currentIndex: 2,
    } as CdkDragDrop<string[]>;
    component.drop(event);

    expect(
      component.tempClassroomData.setTopicIdToPrerequisiteTopicId
    ).toHaveBeenCalled();
  });

  it('should present a graph modal before topics dependency visualization', fakeAsync(() => {
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      {
        ...dummyClassroomDict,
        topicIdToPrerequisiteTopicIds: {
          topicId1: [],
          topicId2: ['topicId1'],
          topicId3: ['topicId2', 'topicId1'],
        },
      }
    );
    component.topicIdsToTopicName = {
      topicId1: 'Topic 1',
      topicId2: 'Topic 2',
      topicId3: 'Topic 3',
    };

    spyOn(ngbModal, 'open').and.returnValue({
      componentInstance: {},
      result: Promise.resolve(),
    } as NgbModalRef);

    component.viewGraph();
    tick();

    expect(ngbModal.open).toHaveBeenCalled();
  }));

  it('should be able to cancel the topics graph visualization', fakeAsync(() => {
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      {
        ...dummyClassroomDict,
        topicIdToPrerequisiteTopicIds: {
          topicId1: [],
          topicId2: ['topicId1'],
          topicId3: ['topicId2', 'topicId1'],
        },
      }
    );
    component.topicIdsToTopicName = {
      topicId1: 'Topic 1',
      topicId2: 'Topic 2',
      topicId3: 'Topic 3',
    };

    spyOn(ngbModal, 'open').and.returnValue({
      componentInstance: {},
      result: Promise.reject(),
    } as NgbModalRef);

    component.viewGraph();
    tick();

    expect(ngbModal.open).toHaveBeenCalled();
  }));

  it('should be able to get length of prerequisites', () => {
    component.topicNameToPrerequisiteTopicNames = {
      'Dummy topic 1': [],
      'Dummy topic 2': ['Dummy topic 1'],
      'Dummy topic 3': ['Dummy topic 1'],
    };

    expect(component.getPrerequisiteLength('Dummy topic 1')).toEqual(0);
    expect(component.getPrerequisiteLength('Dummy topic 2')).toEqual(1);
    expect(component.getPrerequisiteLength('Dummy topic 3')).toEqual(1);
  });

  it('should be able to publish classroom', fakeAsync(() => {
    const response = {
      classroomDict: {
        ...dummyClassroomDict,
        topicIdToPrerequisiteTopicIds: {
          id: [],
        },
        isPublished: false,
      },
    };
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.classroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );

    expect(component.allValidationErrors.length).toEqual(0);
    spyOn(component, 'updateClassroomData').and.returnValue(Promise.resolve());
    tick();

    component.togglePublicationStatus();
    component.saveClassroomData();
    expect(component.updateClassroomData).toHaveBeenCalled();
  }));

  it('should toggle diagnostic test status', () => {
    const response = {
      classroomDict: {
        ...dummyClassroomDict,
      },
    };
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.classroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );

    expect(
      component.tempClassroomData.getDiagnosticTestIsEnabled()
    ).toBeFalse();

    component.toggleDiagnosticTestStatus();

    expect(component.tempClassroomData.getDiagnosticTestIsEnabled()).toBeTrue();
    expect(component.classroomDataIsChanged).toBeTrue();
  });

  it('should not be able to publish classroom due to validation errors', () => {
    const response = {
      classroomDict: {
        ...dummyClassroomDict,
        isPublished: true,
      },
    };
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.classroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.tempClassroomData.setClassroomName('');
    component.classroomDataIsChanged = false;
    component.updateClassroomField();

    expect(component.allValidationErrors.length).toEqual(3);
  });

  it('should not be able to save classroom due to validation errors', () => {
    const response = {
      classroomDict: {
        ...dummyClassroomDict,
        name: '',
        urlFragment: '',
        isPublished: false,
      },
    };
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.classroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.updateClassroomField();

    expect(component.saveClassroomValidationErrors.length).toEqual(2);
  });

  it('should not save a published classroom if user deletes some data', () => {
    spyOn(component, 'updateClassroomData');
    const response = {
      classroomDict: {
        ...dummyClassroomDict,
        name: '',
        urlFragment: '',
        isPublished: true,
        teaserText: '',
      },
    };
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.classroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.updateClassroomField();
    component.saveClassroomData();

    expect(component.canSaveClassroom()).toBeFalse();
    expect(component.updateClassroomData).not.toHaveBeenCalled();
  });

  it('should be able to unpublish a published classroom', fakeAsync(() => {
    const response = {
      classroomDict: {
        ...dummyClassroomDict,
        isPublished: true,
      },
    };
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );
    component.classroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );

    spyOn(component, 'updateClassroomData').and.returnValue(Promise.resolve());
    tick();

    component.togglePublicationStatus();
    component.saveClassroomData();
    expect(component.updateClassroomData).toHaveBeenCalled();
  }));

  it(
    'should clear custom context when ngOnDestroy is called or when' +
      ' thumbnail/banner filename is not provided',
    fakeAsync(() => {
      spyOn(contextService, 'removeCustomEntityContext');
      component.ngOnDestory();
      expect(contextService.removeCustomEntityContext).toHaveBeenCalled();

      let response = {
        classroomDict: {
          ...dummyClassroomDict,
          thumbnailData: {
            ...dummyThumbnailData,
            filename: '',
          },
        },
      };
      spyOn(
        classroomBackendApiService,
        'getClassroomDataAsync'
      ).and.returnValue(Promise.resolve(response));

      component.getClassroomData('classroomId');
      tick();

      expect(contextService.removeCustomEntityContext).toHaveBeenCalled();
    })
  );

  it('should open the UpdateClassroomsOrderModal and update classroom index mappings', fakeAsync(() => {
    const modalRef = {
      componentInstance: {},
      result: Promise.resolve([
        {classroom_id: 'classroomId_1', classroom_index: 2},
      ]),
    } as NgbModalRef;

    spyOn(ngbModal, 'open').and.returnValue(modalRef);
    spyOn(
      classroomBackendApiService,
      'updateClassroomIndexMappingAsync'
    ).and.returnValue(Promise.resolve());

    component.changeClassroomsOrder();
    tick();

    expect(ngbModal.open).toHaveBeenCalledWith(
      UpdateClassroomsOrderModalComponent,
      {backdrop: 'static'}
    );
    expect(
      classroomBackendApiService.updateClassroomIndexMappingAsync
    ).toHaveBeenCalledWith([
      {classroom_id: 'classroomId_1', classroom_index: 2},
    ]);
    expect(component.classroomIdToClassroomNameIndex).toEqual([
      {classroom_id: 'classroomId_1', classroom_index: 2},
    ]);
  }));

  it('should set existingClassroomNames correctly when getting classroom data', fakeAsync(() => {
    component.classroomEditorMode = false;
    component.classroomViewerMode = false;
    const response = {
      classroomDict: dummyClassroomDict,
    };
    component.tempClassroomData = ExistingClassroomData.createClassroomFromDict(
      response.classroomDict
    );

    component.classroomIdToClassroomNameIndex = [
      {classroom_id: 'id1', classroom_name: 'Classroom 1', classroom_index: 0},
      {classroom_id: 'id2', classroom_name: 'Classroom 2', classroom_index: 1},
    ];

    spyOn(
      component.classroomBackendApiService,
      'getClassroomDataAsync'
    ).and.returnValue(Promise.resolve(response));

    component.getClassroomData('id1');
    tick();

    expect(component.existingClassroomNames).toEqual(['Classroom 1']);
  }));
});
