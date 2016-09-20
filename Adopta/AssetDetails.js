///////////////////////////////////////////////////////////////////////////
// Copyright © 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
  'dojo/_base/declare',
  'dojo/_base/array',
  'jimu/BaseWidget',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/text!./AssetDetails.html',
  'dojo/_base/lang',
  'dijit/layout/ContentPane',
  'dojo/on',
  'dojo/dom-construct',
  'dojo/dom-class',
  'dojo/dom-attr',
  'dijit/form/TextBox',
  'esri/tasks/locator',
  'esri/geometry/webMercatorUtils',
  'esri/tasks/query',
  'dojo/Evented',
  'dojo/Deferred',
  'dojo/string',
  'jimu/utils',
  'dojo/query',
  'esri/graphic'
], function (
  declare,
  array,
  BaseWidget,
  _WidgetsInTemplateMixin,
  template,
  lang,
  ContentPane,
  on,
  domConstruct,
  domClass,
  domAttr,
  TextBox,
  Locator,
  webMercatorUtils,
  Query,
  Evented,
  Deferred,
  string,
  jimuUtils,
  dojoQuery,
  Graphic
) {
  return declare([BaseWidget, _WidgetsInTemplateMixin, Evented], {

    baseClass: 'jimu-widget-Adopta-AssetDetails',
    templateString: template,
    nickNameInputTextBox: null,
    layer: null,
    countLabel: null,
    maxLength: null,
    actionPerformedInDetails: {},
    prevNicknameValue: null,
    primaryAction: null,
    constructor: function (options) {
      lang.mixin(this, options);
    },

    postCreate: function () {
      domClass.add(this.domNode, "esriCTFullHeight");

      //create container to display feature popup info
      this._featureInfoPanel = new ContentPane({
        "id": 'divFeatureInfoContent'
      }, this.assetInfoPopupDetails);
      this._featureInfoPanel.startup();

      //Check for reverse geocoding Boolean flag
      if (this.config.showReverseGeocodedAddress) {
        domClass.remove(this.streetAddressContainer, "esriCTHidden");
        this._initReverseGeocoder();
      }
      //get primary action
      this._setPrimaryAction();
    },

    /**
    * Set's primary action to be considered from the configuration
    * @memberOf widgets/Adopta/MyAssets
    **/
    _setPrimaryAction: function () {
      var i;
      for (i = 0; i < this.config.actions.additionalActions.length; i++) {
        if (this.config.actions.additionalActions[i].displayInMyAssets) {
          this.primaryAction = lang.clone(this.config.actions.additionalActions[i]);
          break;
        }
      }
    },

    /**
    * Create details panel for selected asset
    * @param {object} selected feature
    * @memberOf widgets/Adopta/AssetDetails
    */
    showAssetInfoPopup: function (selectedFeature) {
      var assetStatus;
      this.selectedFeature = selectedFeature;
      this.showPanel("assetDetails");
      this._featureInfoPanel.setContent(this.selectedFeature.getContent());
      if (this._locatorInstance) {
        //For point layer take the clicked location
        if (selectedFeature.geometry.type === "point") {
          this._locatorInstance.locationToAddress(webMercatorUtils.webMercatorToGeographic(
            selectedFeature.geometry), 100);
        } else {
          //For line/polygon take the center point of selected feature
          this._locatorInstance.locationToAddress(webMercatorUtils.webMercatorToGeographic(
            selectedFeature.geometry.getExtent().getCenter()), 100);
        }
      }
      assetStatus = this._checkAssetAdoptionStatus(this.selectedFeature);
      this._createAdoptActionContainer(assetStatus);
    },

    /**
    * Check whether the asset is already adopted or not
    * @memberOf widgets/Adopta/AssetDetails
    */
    _checkAssetAdoptionStatus: function (selectedFeature) {
      var relatedGUID, isAssetAdopted = false, isAssetAdoptedByLoggedInUser = false;
      relatedGUID = selectedFeature.attributes[this.config.foreignKeyFieldForUserTable];

      if (relatedGUID && relatedGUID !== null && lang.trim(relatedGUID) !== "") {
        //Check for curly braces
        if (relatedGUID.indexOf("{") === -1) {
          relatedGUID = "{" + relatedGUID + "}";
        }
        isAssetAdopted = true;
      }
      if (this.config.userDetails && isAssetAdopted && relatedGUID.toLowerCase() ===
        "{" + this.config.userDetails[this.config.foreignKeyFieldForUserTable]
        .toLowerCase() + "}") {
        isAssetAdoptedByLoggedInUser = true;
      }
      return {
        "isAssetAdopted": isAssetAdopted,
        "isAssetAdoptedByLoggedInUser": isAssetAdoptedByLoggedInUser
      };
    },

    /**
    * Create action container as per configuration
    * @param {object} selected assets status
    * @memberOf widgets/Adopta/AssetDetails
    */
    _createAdoptActionContainer: function (assetStatus) {
      var nicknameContainer, adoptBtnContainer, adoptBtn, showNickNameInput;
      domConstruct.empty(this.adoptActionContainer);
      //nickname input will be shown only when nickname field is configured
      if (this.config.nickNameField && this.config.nickNameField !== "") {
        showNickNameInput = true;
        //Hide textbox if asset is already adopted by other user
        if (assetStatus.isAssetAdopted && !assetStatus.isAssetAdoptedByLoggedInUser) {
          showNickNameInput = false;
        }
        if (showNickNameInput) {
          this.countLabel = domConstruct.create("div", { "class": "esriCTCountLabelContainer" },
            this.adoptActionContainer);
          nicknameContainer = domConstruct.create("div", {
            "class": "esriCTFullWidth"
          }, this.adoptActionContainer);
          this.nickNameInputTextBox = new TextBox({
            placeHolder: this.config.nameAssetTextBoxPlaceholder
          });
          this.nickNameInputTextBox.placeAt(nicknameContainer);
          //set maximum length for nickname field
          this._setTextAreaMaxLength();
          this.own(on(this.nickNameInputTextBox, "keyup", lang.hitch(this, function () {
            this._calculateCharactersCount();
          })));
          //If user is not logged in, disable nickname input box
          if (!this.config.userDetails) {
            this.nickNameInputTextBox.set("disabled", true);
          }
        }
      }
      adoptBtnContainer = domConstruct.create("div", {
        "class": "esriCTAdoptButtonContainer"
      }, this.adoptActionContainer);
      adoptBtn = domConstruct.create("div", {
        "class": "esriCTAdoptButton esriCTEllipsis jimu-btn"
      }, adoptBtnContainer);
      this._setAdoptButtonState(assetStatus, adoptBtn);
      //If actions container is already created remove it from the node
      domConstruct.empty(this.additionalActionContainer);
      if (assetStatus.isAssetAdoptedByLoggedInUser) {
        this._createActionButtons();
      }
      this.own(on(adoptBtn, "click", lang.hitch(this, function () {
        var updatedAttributes = {};
        if (!domClass.contains(adoptBtn, "jimu-state-disabled")) {
          //Check if user is logged in and accordingly perform the actions
          if (this.config.userDetails) {
            //Check if nick name field is empty
            if (this.nickNameInputTextBox) {
              this.selectedFeature.attributes[this.config.nickNameField] =
                this.nickNameInputTextBox.get("value");
              updatedAttributes[this.config.nickNameField] =
                this.nickNameInputTextBox.get("value");
            }
            if (domAttr.get(adoptBtn, "innerHTML") === this.config.actions.assign.name) {
              this._adoptAsset(this.selectedFeature);
            } else {
              //as we are updateing only the nick name field send action as null
              this._updateFeatureDetails(this.selectedFeature, null, true, updatedAttributes);
            }
          } else {
            this.emit("adoptAsset", this.selectedFeature.attributes[this.layer.objectIdField]);
            this.showPanel("login");
          }
        }
      })));
    },

    /**
    * Set appropriate adopt button label
    * @param {object} selected assets status
    * @param {object} adopt button
    * @memberOf widgets/Adopta/AssetDetails
    */
    _setAdoptButtonState: function (assetStatus, adoptBtn) {
      var buttonText;
      if (assetStatus.isAssetAdopted && !assetStatus.isAssetAdoptedByLoggedInUser) {
        domClass.add(adoptBtn, "jimu-state-disabled");
        buttonText = this.config.actions.unAssign.name;
      } else {
        if (assetStatus.isAssetAdoptedByLoggedInUser) {
          if (this.config.nickNameField !== "") {
            this.nickNameInputTextBox.set("value",
             this.selectedFeature.attributes[this.config.nickNameField]);
            //Take current nickname fields value into variable which will be used to  compare content
            this.prevNicknameValue = this.selectedFeature.attributes[this.config.nickNameField];
            this._calculateCharactersCount();
          }
          //If nickname field is not configured hide the adopt/update button
          if (!this.config.nickNameField) {
            domClass.add(adoptBtn, "esriCTHidden");
          } else {
            domClass.add(adoptBtn, "jimu-state-disabled");
            buttonText = this.nls.nickNameUpdateButtonLabel;
          }
        } else {
          buttonText = this.config.actions.assign.name;
        }
      }
      domAttr.set(adoptBtn, "innerHTML", buttonText);
      domAttr.set(adoptBtn, "title", buttonText);
    },

    /**
    * emit name of panel that needs to be shown
    * @param {string} name panel to be shown
    * @memberOf widgets/Adopta/AssetDetails
    */
    showPanel: function (panel) {
      this.emit("showPanel", panel);
    },

    /**
    * This function initialize the Locator widget for reverse geocoding
    * @memberOf widgets/Adopta/AssetDetails
    */
    _initReverseGeocoder: function () {
      //By default if no geocoding service available in org then ArcGis online GeocodeServer will be used for reverse geocoding.
      var geocodeURL =
        "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
      if (this.config.helperServices && this.config.helperServices.geocode &&
        this.config.helperServices.geocode[0] && this.config.helperServices
        .geocode[0].url) {
        geocodeURL = this.config.helperServices.geocode[0].url;
      }
      //create the locator instance to reverse geocode the address
      this._locatorInstance = new Locator(geocodeURL);
      this._locatorInstance.on("location-to-address-complete",
        lang.hitch(this, this._onLocationToAddressComplete));
      //Listen for error in locator
      this._locatorInstance.onError = lang.hitch(this, function (err) {
        this._onLocationToAddressFailed(err);
      });
    },

    /**
    * Callback handler called once location is reverse geocoded
    * @param {object} result of reverse geocoding
    * @memberOf widgets/Adopta/AssetDetails
    */
    _onLocationToAddressComplete: function (result) {
      //check if address available
      if (result.address && result.address.address) {
        this.locationAddress.innerHTML = result.address.address.Address;
      }
    },

    /**
    * Error back handler called once location is not reverse geocoded
    * @memberOf widgets/Adopta/AssetDetails
    */
    _onLocationToAddressFailed: function () {
      this.locationAddress.innerHTML = this.nls.streetAddressNotFoundText;
    },

    /**
    * Get selected asset's title
    * @param {object} current selected feature
    * @memberOf widgets/Adopta/AssetDetails
    */
    _getAssetTitle: function (selectedFeature) {
      var adoptedAssetString;
      if (lang.trim(this.config.nickNameField) !== "" &&
        selectedFeature.attributes[this.config.nickNameField] &&
        lang.trim(selectedFeature.attributes[this.config.nickNameField]) !== "") {
        adoptedAssetString = lang.trim(selectedFeature.attributes[this.config.nickNameField]);
      } else if (selectedFeature.getTitle() && lang.trim(selectedFeature.getTitle()) !== "") {
        adoptedAssetString = lang.trim(selectedFeature.getTitle());
      } else if (selectedFeature.attributes[this.layer.displayField] &&
        selectedFeature.attributes[this.layer.displayField] !== "") {
        adoptedAssetString = selectedFeature.attributes[this.layer.displayField];
      } else {
        adoptedAssetString = this.layer.name + " : " +
          selectedFeature.attributes[this.layer.objectIdField];
      }
      return adoptedAssetString;
    },

    /**
    * Function to adopt an selected asset
    * @param {object} current selected feature
    * @memberOf widgets/Adopta/AssetDetails
    */
    _adoptAsset: function (selectedFeature) {
      //Add users guid into asset to identify which asset belongs to user
      selectedFeature.attributes[this.config.foreignKeyFieldForUserTable] = "{" + this.config
        .userDetails[this.config.foreignKeyFieldForUserTable] + "}";
      this.updateFieldsForAction(this.config.actions.assign.name, selectedFeature, true);
    },

    /**
    * Update selected asset details
    * @param {object} current selected feature
    * @param {string} current action
    * @param {boolean} flag to decide the visibility of details panel
    * @memberOf widgets/Adopta/AssetDetails
    */
    _updateFeatureDetails: function(selectedFeature, actionName, showAssetDetails,
     updatedAttributes) {
      var isNewAssetAdopted, adoptionCompleteMsg, updatedFeatureAttributes = {},
        showMesssage = true, graphicsArray = [];
      //if action is adopted it means new asset is adopted
      if (actionName === this.config.actions.assign.name) {
        isNewAssetAdopted = true;
        //If action is assign, check if nick name field has some value and pass the
        //attribute to apply edits
        if (this.config.nickNameField && this.nickNameInputTextBox &&
          lang.trim(this.nickNameInputTextBox.get("value")) !== "") {
          updatedAttributes[this.config.nickNameField] = this.nickNameInputTextBox.get("value");
        }
      } else {
        isNewAssetAdopted = false;
      }
      //Add objectId of selected Feature before updating the feature values
      updatedAttributes[this.layer.objectIdField] =
        selectedFeature.attributes[this.layer.objectIdField];
      this.loading.show();
      adoptionCompleteMsg = this._createMessageFromString('assetTitle', this.config
        .adoptionCompleteMsg, this._getAssetTitle(selectedFeature));
      updatedFeatureAttributes = new Graphic(null, null, updatedAttributes, null);
      graphicsArray.push(updatedFeatureAttributes);
      this.layer.applyEdits(null, graphicsArray, null, lang.hitch(this,
        function (added, updated, deleted) {
          /*jshint unused: false*/
          if (updated[0].success) {
            //update action performed array to show green check symbol for primary action
            this._updateActionPerformedArray(actionName, selectedFeature);
            //Refresh layer and show the updated information in asset details panel
            this.layer.refresh();
            if (showAssetDetails) {
              this.showAssetInfoPopup(selectedFeature);
            } else {
              this.emit("showMyAssets", selectedFeature);
            }
            if (isNewAssetAdopted) {
              this.emit("showMessage", adoptionCompleteMsg);
              //If asset is adopted, increment the count of total number of adopted asset by logged in user
              this.emit("assetAdopted", selectedFeature.attributes[this.layer.objectIdField]);
            } else {
              this.emit("actionPerformed", actionName,
                selectedFeature.attributes[this.layer.objectIdField]);
              if (actionName === this.config.actions.unAssign.name) {
                this.emit("showMessage", this.config.abandonCompleteMsg);
                if (selectedFeature.symbol) {
                  selectedFeature.symbol = null;
                }
                //Remove previously saved nick name
                if (this.prevNicknameValue) {
                  this.prevNicknameValue = null;
                }
                //if action is unAssign update the highlight symbol
                this.emit("highlightFeatureOnMap", selectedFeature);
              } else {
                //Check if action name exist, if not we assume user has updated assets nickname
                if ((this.primaryAction && this.primaryAction.name === actionName) ||
                  !actionName) {
                  showMesssage = false;
                }
                if (showMesssage) {
                  this.emit("showMessage", this._createMessageFromString(
                    "actionName", this.config.actionCompleteMsg, actionName
                  ));
                }
              }
            }
          } else {
            //if action is adopted it means new asset is adopted
            if (actionName === this.config.actions.assign.name) {
              //Show error if adoption fails
              this.emit("showMessage", this.nls.unableToAdoptAssetMsg);
            } else {
              this.emit("showMessage", this._createMessageFromString(
                "actionName", this.nls.actionFailedMsg, actionName));
            }
          }
          this.loading.hide();
        }), lang.hitch(this, function () {
          //if action is adopted it means new asset is adopted
          if (actionName === this.config.actions.assign.name) {
            //Show error if adoption fails
            this.emit("showMessage", this.nls.unableToAdoptAssetMsg);
          } else {
            this.emit("showMessage", this._createMessageFromString("actionName",
              this.nls.actionFailedMsg, actionName));
          }
          this.loading.hide();
        }));
    },

    /**
    * Function to update the fields specified in actions
    * @param {string} current action
    * @param {object} current selected feature
    * @param {boolean} flag to decide the visibility of details panel
    * @memberOf widgets/Adopta/AssetDetails
    */
    updateFieldsForAction: function (actionName, selectedFeature, showAssetDetails) {
      var fieldsToUpdate, updatedAttributes = {};
      //check if action is unAssign choose its fields to update
      if (actionName === this.config.actions.unAssign.name) {
        fieldsToUpdate = this.config.actions.unAssign.fieldsToUpdate;
      } else if (actionName === this.config.actions.assign.name) {
        //Add related GUI field value from respective field
        this.config.actions.assign.fieldsToUpdate[0].value = "{" + this.config
          .userDetails[this.config.foreignKeyFieldForUserTable] + "}";
        //check if action is assign choose its fields to update and set adopt action flag
        fieldsToUpdate = this.config.actions.assign.fieldsToUpdate;
      }
      else {
        array.some(this.config.actions.additionalActions, lang.hitch(this,
          function (currentAction) {
            if (actionName === currentAction.name) {
              fieldsToUpdate = currentAction.fieldsToUpdate;
              return true;
            }
          }));
      }
      //set values in attributes as in configured action
      array.forEach(fieldsToUpdate, lang.hitch(this,
        function (currentAction) {
          switch (currentAction.action) {
          case "SetValue":
            selectedFeature.attributes[currentAction.field] = currentAction.value;
            updatedAttributes[currentAction.field] = currentAction.value;
            break;
          case "SetDate":
            selectedFeature.attributes[currentAction.field] = Date.now();
            updatedAttributes[currentAction.field] = Date.now();
            break;
          case "Clear":
            selectedFeature.attributes[currentAction.field] = null;
            updatedAttributes[currentAction.field] = null;
            break;
          }
        }));
      this._updateFeatureDetails(selectedFeature, actionName, showAssetDetails, updatedAttributes);
    },

    /**
    * Function to fetch selected asset through URL parameter
    * @param {string} selected asset id
    * @memberOf widgets/Adopta/AssetDetails
    */
    fetchSelectedAsset: function (assetId) {
      var queryField, def = new Deferred();
      queryField = new Query();
      queryField.where = this.layer.objectIdField + " = " + assetId;
      queryField.returnGeometry = true;
      queryField.outFields = ["*"];
      // Query for the features with the logged in UserId
      this.layer.queryFeatures(queryField, lang.hitch(this, function (
          response) {
        def.resolve(response);
      }), function () {
        def.reject([]);
      });
      return def.promise;
    },

    /**
    * Function to fetch selected asset details
    * @param {string} selected asset id
    * @memberOf widgets/Adopta/AssetDetails
    */
    getSelectedAssetDetails: function (response) {
      if (response && response.features[0]) {
        //check if asset is already adopted
        if (this._checkAssetAdoptionStatus(response.features[0]).isAssetAdopted) {
          this.emit("showMessage",
            this._createMessageFromString('assetTitle', this.config.assetAlreadyAdoptedMsg,
            this._getAssetTitle(response.features[0])));
        } else {
          //If nickname text input exist, make it empty to make sure it does not mixin with next selected asset
          if (this.nickNameInputTextBox) {
            this.nickNameInputTextBox.set('value', "");
          }
          this._adoptAsset(response.features[0]);
        }
        this.showAssetInfoPopup(response.features[0]);
        this.emit("highlightFeatureOnMap", this.selectedFeature);
      } else {
        //Show error if adoption fails
        this.emit("showMessage", this.config.assetNotFoundMsg);
      }
    },

    /**
    * Function to create action button for selected assets based on configuration
    * @memberOf widgets/Adopta/AssetDetails
    */
    _createActionButtons: function () {
      var additionalActionsContainer;
      domConstruct.empty(this.additionalActionContainer);
      additionalActionsContainer = domConstruct.create("div", {}, this.additionalActionContainer);
      array.forEach(this.config.actions.additionalActions, lang.hitch(this,
        function (currentAction) {
          this._createBtn(currentAction, additionalActionsContainer);
        }));
      this._createBtn(this.config.actions.unAssign, additionalActionsContainer);
    },

    /**
    * Create action button
    * @param {string} current action
    * @param {string} parent node for action button
    * @memberOf widgets/Adopta/AssetDetails
    */
    _createBtn: function (currentAction, parentNode) {
      var actionBtn, actionBtnContainer, featureObjectId, adoptActionBtnContainer,
      imageContainer;
      featureObjectId = this.selectedFeature.attributes[this.layer.objectIdField];
      actionBtnContainer = domConstruct.create("div", {
        "class": "esriCTActionPerformedContainer esriCTCursorPointer"
      }, parentNode);

      actionBtn = domConstruct.create("div", {
        "class": "esriCTEllipsis esriCTStaticWidth",
        "innerHTML": jimuUtils.sanitizeHTML(currentAction.name),
        "title": currentAction.name
      }, actionBtnContainer);

      adoptActionBtnContainer = domConstruct.create("div", {
        "class": "esriCTBtnContainer"
      }, actionBtnContainer);

      imageContainer = domConstruct.create("img", {
        "class": "esriCTAssetDetailsImageDimensions"
      }, adoptActionBtnContainer);

      //If primary action is already performed on an asset, make sure we display green check box
      if (this.actionPerformedInDetails &&
        this.actionPerformedInDetails.hasOwnProperty(featureObjectId) &&
        this.actionPerformedInDetails[featureObjectId].indexOf(currentAction.name) !== -1) {
        this._createImageFromData(this.config.afterActionImage, imageContainer);
        domClass.remove(actionBtnContainer, "esriCTCursorPointer");
      } else {
        this._createImageFromData(this.config.beforeActionImage, imageContainer);
        domAttr.set(actionBtnContainer, "actionLabel", currentAction.name);
        this.own(on(actionBtnContainer, "click", lang.hitch(this, function (evt) {
          this._fetchFieldsToBeUpdated(domAttr.get(evt.currentTarget, "actionLabel"));
        })));
      }
    },

    /**
    * Create image form image URL/image data
    * @param {string} current action
    * @param {string} parent node in which image will be displayed
    * @memberOf widgets/Adopta/AssetDetails
    */
    _createImageFromData: function (action, imageNode) {
      var baseURL, imageSrc;
      if (action) {
        if (action.imageData.indexOf("${appPath}") > -1) {
          baseURL = location.href.slice(0, location.href.lastIndexOf(
            '/'));
          imageSrc = string.substitute(action.imageData, {
            appPath: baseURL
          });
        } else {
          imageSrc = action.imageData;
        }
      }
      domAttr.set(imageNode, "src", imageSrc);
    },

    /**
    * Obtained fields to be updated for particular action
    * @param {string} current action
    * @memberOf widgets/Adopta/AssetDetails
    */
    _fetchFieldsToBeUpdated: function (actionName) {
      this.updateFieldsForAction(actionName, this.selectedFeature, true);
    },

    /**
    * Display character count
    * @memberOf widgets/Adopta/AssetDetails
    */
    _setTextAreaMaxLength: function () {
      array.forEach(this.layer.fields, lang.hitch(this, function (currentField) {
        if (currentField.name === this.config.nickNameField) {
          this.maxLength = currentField.length;
          return true;
        }
      }));
      this.nickNameInputTextBox.set("maxlength", this.maxLength);
      this.countLabel.innerHTML = this.maxLength;
    },

    /**
    * Calculating character count of text area
    * @memberOf widgets/Adopta/AssetDetails
    */
    _calculateCharactersCount: function () {
      var count;
      if (this.nickNameInputTextBox.get("value").length >= this.maxLength) {
        this.nickNameInputTextBox.value =
          this.nickNameInputTextBox.get("value").substring(0, this.maxLength);
        this.nickNameInputTextBox.domNode.blur();
        // Setting the count to "No" if character limit is exceeded
        count = this.nickNameInputTextBox.get("value").length - this.maxLength;
        this.countLabel.innerHTML = count;
      } else {
        // Decreasing the count and displaying the entered character in the textarea
        count = this.maxLength - this.nickNameInputTextBox.get("value").length;
        this.countLabel.innerHTML = count;
      }
      //Check if newly enterd value is different than actual saved value
      if (lang.trim(this.nickNameInputTextBox.get("value")) !== this.prevNicknameValue) {
        if (dojoQuery(".esriCTAdoptButton", this.domNode)[0]) {
          domClass.remove(dojoQuery(".esriCTAdoptButton",
            this.domNode)[0], "jimu-state-disabled");
        }
      } else {
        domClass.add(dojoQuery(".esriCTAdoptButton",
          this.domNode)[0], "jimu-state-disabled");
      }
    },

    /**
    * Update primary action array
    * @param {string} current action
    * @param {object} selected feature
    * @memberOf widgets/Adopta/AssetDetails
    */
    _updateActionPerformedArray: function (actionName, selectedFeature) {
      var objectId = selectedFeature.attributes[this.layer.objectIdField];
      array.forEach(this.config.actions.additionalActions, lang.hitch(this,
        function (currentAction) {
          if (currentAction.name === actionName) {
            if (this.actionPerformedInDetails &&
              !this.actionPerformedInDetails.hasOwnProperty(objectId)) {
              // If the current action key does not exist, add it to action performed object
              this.actionPerformedInDetails[objectId] = [];
              this.actionPerformedInDetails[objectId].push(actionName);
            } else {
              //add other actions into array
              if (this.actionPerformedInDetails[objectId].indexOf(actionName) === -1) {
                this.actionPerformedInDetails[objectId].push(actionName);
              }
            }
          }
        }));

      //If asset is abonded, remove it from the actionPerformed array
      if (this.actionPerformedInDetails &&
        this.actionPerformedInDetails.hasOwnProperty(objectId) &&
        actionName === this.config.actions.unAssign.name) {
        delete this.actionPerformedInDetails[objectId];
      }
      this.emit("updateActionsInAssets", this.actionPerformedInDetails);
    },

    /**
    * Update actions array
    * @param {string} key which will contain value to be substituted
    * @param {string} message from nls
    * @param {string} value which will be substituted with the help of key
    * @memberOf widgets/Adopta/AssetDetails
    */
    _createMessageFromString : function (key, message, keyValue) {
      var newStringMessage, obj = {};
      obj[key] = keyValue;
      if (message.indexOf(key) !== -1) {
        newStringMessage = string.substitute(message, obj);
      } else {
        newStringMessage = message;
      }
      return newStringMessage;
    }
  });
});