///////////////////////////////////////////////////////////////////////////
// Copyright © 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
  'dojo/_base/declare',
  'jimu/BaseWidgetSetting',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/on',
  'dojo/dom-class',
  'dojo/dom-attr',
  'dijit/registry',
  'dijit/_WidgetsInTemplateMixin',
  'jimu/dijit/TabContainer3',
  'dijit/form/Select',
  'jimu/dijit/GpSource',
  'jimu/dijit/Popup',
  'dojo/dom-construct',
  'jimu/dijit/ColorPicker',
  'dojo/_base/Color',
  'dojo/query',
  'jimu/utils',
  'dijit/Editor',
  'dojo/_base/html',
  'dojo/sniff',
  'jimu/dijit/SimpleTable',
  'jimu/dijit/ImageChooser',
  'esri/request',
  'jimu/dijit/Message',
  'jimu/dijit/LoadingIndicator',
  './SymbolChooserPopup',
  './TableField',
  './LayerChooser',
  './Actions',
  'jimu/symbolUtils',
  'esri/symbols/jsonUtils',
  'dojo/string',
  'dojo/aspect',
  'dijit/form/NumberSpinner',
  'dijit/_editor/plugins/LinkDialog',
  'dijit/_editor/plugins/ViewSource',
  'dijit/_editor/plugins/FontChoice',
  'dojox/editor/plugins/Preview',
  'dijit/_editor/plugins/TextColor',
  'dojox/editor/plugins/ToolbarLineBreak',
  'dojox/editor/plugins/FindReplace',
  'dojox/editor/plugins/PasteFromWord',
  'dojox/editor/plugins/InsertAnchor',
  'dojox/editor/plugins/Blockquote',
  'dojox/editor/plugins/UploadImage',
  './ChooseImage',
  'dojo/domReady!'
], function (
  declare,
  BaseWidgetSetting,
  lang,
  array,
  on,
  domClass,
  domAttr,
  registry,
  _WidgetsInTemplateMixin,
  TabContainer3,
  Select,
  GpSource,
  Popup,
  domConstruct,
  ColorPicker,
  Color,
  dojoQuery,
  utils,
  Editor,
  html,
  has,
  SimpleTable,
  ImageChooser,
  esriRequest,
  Message,
  LoadingIndicator,
  SymbolChooserPopup,
  TableField,
  LayerChooser,
  Actions,
  symbolUtils,
  jsonUtils,
  string,
  aspect,
  NumberSpinner
) {

  return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      baseClass: 'jimu-widget-adopta-setting',
      _symbolParams: {},
      _selectedLayerDetails: null,
      primaryActionsDropDown: null,
      imageInfo: {},
      // Array of all the valid input parameters for GP service
      _gpServiceParameters: ["Input_user_email", "Action", "App_URL", "Signup_fields",
        "Asset_popup_configuration", "Widget_configuration", "Adopted_assetid",
        "Userid", "Usertoken"],
      //Default point symbol
      _defaultPointSymbol: {
        "xoffset": 0,
        "yoffset": 0,
        "type": "esriPMS",
        "imageData": "${appPath}/widgets/Adopta/images/default.png",
        "height": "30",
        "width": "30"
      },
      integerTypeToBeValidated: ["esriFieldTypeSmallInteger",
        "esriFieldTypeInteger", "esriFieldTypeSingle",
        "esriFieldTypeDouble"
      ],
      // Default symbols for polygon and polyline
      _defaultPolygonSymbol: {
        "color": [
          255,
          189,
          1,
          0
        ],
        "outline": {
          "color": [
            255,
            189,
            1,
            255
          ],
          "width": 2.25,
          "type": "esriSLS",
          "style": "esriSLSSolid"
        },
        "type": "esriSFS",
        "style": "esriSFSSolid"
      },
      _defaultLineSymbol: {
        "color": [
          21,
          99,
          184,
          201
        ],
        "width": 3.75,
        "type": "esriSLS",
        "style": "esriSLSSolid"
      },
      url: null, //Contains GP service URL
      reserveWebAppURLParams: [
        "id",
        "webmap",
        "find",
        "center",
        "extent",
        "marker",
        "query",
        "locale",
        "token",
        "mobileBreakPoint",
        "userid",
        "usertoken"
      ],
      _actions: {},
      _selectedPrimaryAction: null,
      startup: function () {
      },

      postMixInProperties: function () {
        //mixin default nls with widget nls
        this.nls.common = {};
        this.nls.common = window.jimuNls.common;
      },

      postCreate: function () {
        this._initTabs();
        this.imageInfo = {};
        this._initEditor();
        this._createColorPicker();
        //Create login fields
        this._createAdditionalLoginFieldsGrid();
        this.setConfig(this.config);
        this.own(on(this.authenticationGPServiceNode, 'click', lang.hitch(this,
          this._onChooseTaskClicked)));
        //Populate distance and distance types
        this._fetchDistanceType();
        this._initLoading();
        //handle events
        this.own(on(this.setPrecinctLayerBtnNode, 'click', lang.hitch(
          this,
          this._showLayerChooser)));
        this._createBeforeActionImage();
        this._createAfterActionImage();
        this._createPrimaryStatusRow();
      },

      /**
      * This function the initializes jimu tab for setting and layout
      * @memberOf widgets/NearMe/setting/Setting
      **/
      _initTabs: function () {
        var layerSettingTab, actionSettingTab, messageSettingTab, tabs;
        layerSettingTab = {
          title: this.nls.widgetSettingTabTitle,
          content: this.layerSettingsTabNode
        };
        actionSettingTab = {
          title: this.nls.common.actions,
          content: this.actionSettingsTabNode
        };

        messageSettingTab = {
          title: this.nls.common.messages,
          content: this.stringSettingsTabNode
        };

        tabs = [layerSettingTab, actionSettingTab, messageSettingTab];

        this.tab = new TabContainer3({
          tabs: tabs
        });
        this.tab.placeAt(this.tabDiv);

        this.tab.on("tabChanged", lang.hitch(this, function (
          tabTitle) {
          var tabNode;
          if (tabTitle === this.nls.widgetSettingTabTitle) {
            tabNode = this.layerSettingsTabNode;
          } else if (tabTitle === this.nls.common.actions) {
            tabNode = this.actionSettingsTabNode;
          } else {
            tabNode = this.stringSettingsTabNode;
          }
          //Scroll to top for tab
          tabNode.parentElement.scrollTop = 0;
        }));
      },

      setConfig: function () {
        if (this.config.assetLayerDetails.id) {
          this._fetchAssetLayerDetails(this.config.assetLayerDetails);
          //Populate saved gp service, if valid layer is found
          if (this._selectedLayerDetails) {
            //the config object is passed in
            // validating the fetching the request data
            setTimeout(lang.hitch(this, function () {
              if (this.config && this.config.authGPServiceURL) {
                this.txtURL.set('value', this.config.authGPServiceURL);
                this._validateGPServiceURL();
              }
            }), 200);
            if (this.config.myAssetSymbol) {
              //Populate symbol chooser
              this._populateSymbolChooser();
              if (this.config.assetLayerDetails.geometryType === "esriGeometryPoint") {
                if (this.config.myAssetSymbol.width) {
                  this.widthNodeTextInput.set("value", this.config.myAssetSymbol.width);
                }
                if (this.config.myAssetSymbol.height) {
                  this.heightNodeTextInput.set("value", this.config.myAssetSymbol.height);
                }
              }
            }
            //Create actions container
            this._createActionsContainer();
          }
        }
        if (this.config.foreignKeyFieldForUserTable) {
          this.foreignKeyFieldNode.set("value", this.config.foreignKeyFieldForUserTable.value);
        }
        if (this.config.nickNameField) {
          this.nickNameFieldNode.set("value", this.config.nickNameField.value);
        }
        //set configured color selected in color picker node
        if (this.config.highlightColor) {
          this._highlightColorPicker.setColor(new Color(this.config.highlightColor));
        }
        if (this.config.toleranceSettings.distance ||
          this.config.toleranceSettings.distance === 0) {
          this.distanceNode.set("value", this.config.toleranceSettings.distance);
        }
        if (this.config.loginHelpText) {
          this._editorObj.set("value", this.config.loginHelpText);
        }
        this.assetAddressNode.setValue(this.config.showReverseGeocodedAddress);
        if (this.config.beforeActionImage) {
          this._createBeforeActionImage();
        }
        if (this.config.beforeActionImage) {
          this._createAfterActionImage();
        }
        //populate configured strings into respective text box
        this._populateNotificationStrings();
      },

      getConfig: function () {
        var beforeActionImageData, afterActionImageData;
        if (lang.trim(this.itemSelectDiv.innerHTML) === "") {
          this._errorMessage(this.nls.emptyAssetLayerFieldValueMsg);
          return false;
        }

        if (lang.trim(this.foreignKeyFieldNode.value) === "") {
          this._errorMessage(this.nls.emptyAssetKeyFieldValueMsg);
          return false;
        }

        if (lang.trim(this.txtURL.value) === "") {
          this._errorMessage(this.nls.emptyAuthGPServiceValueMsg);
          return false;
        }
        if (lang.trim(this.distanceNode.displayedValue) === "") {
          this._errorMessage(this.nls.emptyDistanceValueMsg);
          return false;
        } else if (!this.distanceNode.isValid() || this.distanceNode.get("value") < 0) {
          this._errorMessage(this.nls.invalidInput);
          return false;
        }

        this.imageDataObj = "";
        // if imageChooser instance exist and imageData in imageChooser available
        if (this.imageChooser && this.imageChooser.imageData) {
          this.imageDataObj = this.imageChooser.imageData;
        } else if (this.config.myAssetSymbol && this.config.myAssetSymbol
          .imageData) {
          this.imageDataObj = this.config.myAssetSymbol.imageData;
        }

        // if imageChooser instance exist and imageData in imageChooser available
        if (this.afterActionImageChooser && this.afterActionImageChooser.imageData) {
          afterActionImageData = this.afterActionImageChooser.imageData;
        } else if (this.config.afterActionImage && this.config.afterActionImage
          .imageData) {
          afterActionImageData = this.config.afterActionImage.imageData;
        }

        // if imageChooser instance exist and imageData in imageChooser available
        if (this.beforeActionImageChooser && this.beforeActionImageChooser.imageData) {
          beforeActionImageData = this.beforeActionImageChooser.imageData;
        } else if (this.config.beforeActionImage && this.config.beforeActionImage
          .imageData) {
          beforeActionImageData = this.config.beforeActionImage.imageData;
        }

        this.config.foreignKeyFieldForUserTable = this.foreignKeyFieldNode.value;
        this.config.nickNameField = this.nickNameFieldNode.value;
        this.config.highlightColor = this._highlightColorPicker.color.toHex();
        this.config.loginHelpText = this._editorObj.get('value');
        this.config.showReverseGeocodedAddress = this.assetAddressNode.getValue();
        this.config.authGPServiceURL = this.txtURL.value;
        this.config.myAssetSymbol.imageData = this.imageDataObj;
        this.config.beforeActionImage.imageData = beforeActionImageData;
        this.config.afterActionImage.imageData = afterActionImageData;
        //Check for valid height and width dimensions for point layer
        if (this.config.assetLayerDetails.geometryType === "esriGeometryPoint") {
          if (this.widthNodeTextInput.isValid() && this.heightNodeTextInput.isValid()) {
            this.config.myAssetSymbol.width = this.widthNodeTextInput.get("value");
            this.config.myAssetSymbol.height = this.heightNodeTextInput.get("value");
          } else {
            this._errorMessage(this.nls.inValidImageHeighWidthMsg);
            return false;
          }
        } else {
          //Make sure we are removing imageData property from my assets symbol for geometry type other than point
          if (this.config.myAssetSymbol.hasOwnProperty("imageData")) {
            delete this.config.myAssetSymbol.imageData;
          }
        }
        this.config.toleranceSettings.distance = this.distanceNode.value;
        this.config.toleranceSettings.distanceUnits = this.distanceUnitNode.value;
        this.config.additionalLoginParameters = this._displayFieldsTable.getData();
        //check for valid strings
        if (!this._validateNotificationStrings()) {
          return false;
        }

        if (this._validateActionsConfig()) {
          this._updateActionsConfig();
        } else {
          return false;
        }
        return this.config;
      },

      /**
      * Validate entered strings
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _validateNotificationStrings: function () {
        var isValid = true;
        array.some(dojoQuery(".esriCTNotificationStrings", this.stringSettingsTabNode),
          lang.hitch(this, function (currentInput) {
            if (registry.byNode(currentInput) && !registry.byNode(currentInput).isValid()) {
              this._errorMessage(this.nls.invalidOrEmptyMessagesMsg);
              isValid = false;
              return true;
            } else {
              this.config[registry.byNode(currentInput).dojoAttachPoint] =
                registry.byNode(currentInput).get("value");
            }
          }));
        return isValid;
      },

      /**
      * Populate all the configured strings
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _populateNotificationStrings: function () {
        array.some(dojoQuery(".esriCTNotificationStrings", this.stringSettingsTabNode),
          lang.hitch(this, function (currentInput) {
            if (registry.byNode(currentInput)) {
              registry.byNode(currentInput).set("value", this.config[registry.byNode(
                currentInput).dojoAttachPoint]);
            }
          }));
      },

      /**
      * Reset height and width values for symbol chooser
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _bindEvent: function () {
        // Change image dimensions on blur
        on(this.heightNodeTextInput, "change", lang.hitch(this, function () {
          if (this.heightNodeTextInput.isValid()) {
            this.config.myAssetSymbol.height = this.heightNodeTextInput.get("value");
            this._createHighlighterImage();
            //TODO : Revisit the issue where image chooser's image data is null
            this.imageChooser.imageData = this.imageInfo.imageData;
          }
        }));
        on(this.widthNodeTextInput, "change", lang.hitch(this, function () {
          if (this.widthNodeTextInput.isValid()) {
            this.config.myAssetSymbol.width = this.widthNodeTextInput.get("value");
            this._createHighlighterImage();
            //TODO : Revisit the issue where image chooser's image data is null
            this.imageChooser.imageData = this.imageInfo.imageData;
          }
        }));
      },

      /**
      * Update configuration with latest values from actions
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _updateActionsConfig: function () {
        var actionsKey, actionsObj;
        //Remove previous array of additional actions
        this.config.actions.additionalActions = [];
        for (actionsKey in this._actions) {
          if (this._actions[actionsKey]) {
            actionsObj = this._actions[actionsKey].getConfig(this._selectedPrimaryAction,
              this._actions[actionsKey].index);
            //If assign action is returned, add it to actions object
            if (actionsObj.urlParameterLabel === "assign" &&
              this._actions[actionsKey].index === 0) {
              this.config.actions.assign = actionsObj;
              //If unassign action is returned, add it to actions object
            } else if (actionsObj.urlParameterLabel === "unassign" &&
              this._actions[actionsKey].index === 1) {
              this.config.actions.unAssign = actionsObj;
            }
            //Otherwise add all the other actions to additional actions
            else {
              this.config.actions.additionalActions.push(actionsObj);
            }
          }
        }
      },

      /**
      * Validate values in actions
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _validateActionsConfig: function () {
        var actionsObj, actionsNameArray = [],
          urlParameterObj = {},
          duplicateURLParameter,
          validAdditionalActions = true,
          actionsKey, urlParamsPattern = /^((?:[a-zA-Z0-9]+|[.]|[-]|[~]|[_])+)$/,
          regEx = new RegExp(urlParamsPattern);
        for (actionsKey in this._actions) {
          actionsObj = this._actions[actionsKey].getConfig(this._selectedPrimaryAction,
            this._actions[actionsKey].index);
          //If action name is EMPTY, show error message
          if (actionsObj.name === "") {
            this._errorMessage(this.nls.actions.emptyActionNameMsg);
            return false;
          } else {
            //Check for duplicate action name
            if (actionsNameArray.indexOf(actionsObj.name) !== -1) {
              this._errorMessage(string.substitute(this.nls.actions.duplicateActionNameMsg, {
                "actionName": actionsObj.name
              }));
              return false;
            }
            actionsNameArray.push(actionsObj.name);
          }
          //If URL parameter is EMPTY, show error message
          if (actionsObj.urlParameterLabel === "") {
            this._errorMessage(string.substitute(this.nls.actions.emptyURLParamMsg, {
              "actionName": actionsObj.name
            }));
            return false;
          } else {
            urlParameterObj[actionsObj.name] = actionsObj.urlParameterLabel;
            //If URL parameter is not EMPTY, check if entered URL parameter does not conflicts with default reserved web app builder parameters
            if (this.reserveWebAppURLParams.indexOf(actionsObj.urlParameterLabel) !== -1) {
              this._errorMessage(string.substitute(this.nls.actions.invalidURLParameter, {
                "urlParameter": actionsObj.urlParameterLabel,
                actionName: actionsObj.name
              }));
              return false;
            }
            //Check for valid characters allowed in url parameter
            if (!regEx.exec(actionsObj.urlParameterLabel)) {
              this._errorMessage(string.substitute(
                this.nls.actions.invalidCharacterInURLParameter, {
                  "urlParameter": actionsObj.urlParameterLabel,
                  actionName: actionsObj.name
                }));
              return false;
            }
          }
          //Check if at least one additional action is added
          if (actionsObj.fieldsToUpdate.length > 0) {
            validAdditionalActions = this._validateAdditionalActions(actionsObj);
          } else {
            //If no additional actions are added in an action, show error message
            this._errorMessage(string.substitute(this.nls.actions.noAdditionalActionMsg, {
              "actionName": actionsObj.name
            }));
            validAdditionalActions = false;
          }
          if (!validAdditionalActions) {
            return false;
          }
        }
        duplicateURLParameter = [];
        //Loop all the actions for url parameters
        for (var key in urlParameterObj) {
          duplicateURLParameter = [];
          for (var currentKey in urlParameterObj) {
            if (urlParameterObj[key] === urlParameterObj[currentKey]) {
              duplicateURLParameter.push({
                "action": currentKey,
                "parameter": urlParameterObj[key]
              });
            }
          }
          //Check for duplicate url params
          if(!this._validateDuplicateUrlParams(duplicateURLParameter)){
            return false;
          }
        }
        return true;
      },

      /**
      * Validate duplicate url parameters in actions
      * @param{array} duplicateURLParameter : url parameters array
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _validateDuplicateUrlParams: function (duplicateURLParameter) {
        var msgString;
        //Check for more than one duplicate url parameter name in actions
        if (duplicateURLParameter.length > 1) {
          msgString = "";
          array.forEach(duplicateURLParameter, lang.hitch(this, function (currentObj, index) {
            msgString = msgString + currentObj.action;
            if (index < duplicateURLParameter.length - 1) {
              msgString += ",";
            }
          }));
          this._errorMessage(string.substitute(this.nls.actions.duplicateURLParamMsg, {
            "urlParameter": duplicateURLParameter[0].parameter,
            "actionName": msgString
          }));
          return false;
        }
        return true;
      },

      setButtonClicked: function () {
        var tableField, param, popup;
        param = {
          nls: this.nls
        };
        //create instance for layer chooser widget
        tableField = new TableField(param);
        //open widget in jimu popup dialog
        popup = new Popup({
          titleLabel: this.nls.additionalFieldDisplayLabel,
          width: 500,
          height: 250,
          content: tableField
        });
      },

      /**
      * Validate additional actions
      * @param{object} actionsObj : current actions object
      * @param{object} currentAction : selected action
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _validateAdditionalActions: function (actionsObj) {
        var additionalActionArray = [], validAdditionalActions = true;
        array.some(actionsObj.fieldsToUpdate, lang.hitch(this, function (currentAction) {
          //If same field is configured in single action, show error message
          if (additionalActionArray.indexOf(currentAction.field) !== -1) {
            this._errorMessage(string.substitute(this.nls.actions.duplicateActionMsg, {
              "fieldName": currentAction.field, "actionName": actionsObj.name
            }));
            validAdditionalActions = false;
            return true;
          }
          additionalActionArray.push(currentAction.field);
          //If "setValue" action is selected and value is EMPTY, show error message
          if (currentAction.action === "SetValue" && currentAction.value === "") {
            this._errorMessage(string.substitute(this.nls.actions.emptySetValueMsg, {
              "fieldName": currentAction.field, "actionName": actionsObj.name
            }));
            validAdditionalActions = false;
            return true;
          }
          //If invalid value is entered in set value textbox show error message
          if (currentAction.action === "SetValue" && currentAction.value !== "") {
            if (!this._validateValueForField(currentAction, actionsObj)) {
              validAdditionalActions = false;
              return true;
            }
          }
        }));
        return validAdditionalActions;
      },

      /**
      * Validate set value fields value
      * @param{object} currentAction : selected action
      * @param{object} actionsObj : current actions object
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _validateValueForField: function (currentAction, actionsObj) {
        var isValid = true;
        array.some(this._selectedLayerDetails.fields,
          lang.hitch(this, function (currentField) {
            if (currentAction.field === currentField.name) {
              if (this.integerTypeToBeValidated.indexOf(currentField.type) > -1 &&
                isNaN(currentAction.value)) {
                this._errorMessage(string.substitute(this.nls.actions.invalidSetValueMsg, {
                  "fieldName": currentAction.field, "actionName": actionsObj.name
                }));
                isValid = false;
                return true;
              }
            }
          }));
        return isValid;
      },

      /**
      * Creates and show popup to choose layers.
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _showLayerChooser: function () {
        var param, layerChooser, popup;
        param = {
          "portalUrl": this.appConfig.portalUrl,
          "nls": this.nls,
          "folderUrl": this.folderUrl,
          "map": this.map
        };
        layerChooser = new LayerChooser(param);
        popup = new Popup({
          titleLabel: this.nls.assetLayerLabel,
          width: 800,
          height: 200,
          content: layerChooser
        });
        layerChooser.onCancelClick = lang.hitch(this, function () {
          popup.close();
        });

        layerChooser.onOKButtonClicked = lang.hitch(this, function (
          selectedLayerDetails) {
          popup.close();
          //Reset layer dependant values in configuration UI
          this.config.foreignKeyFieldForUserTable = "";
          this.config.nickNameField = "";
          this._fetchAssetLayerDetails(selectedLayerDetails);
          if (this._selectedLayerDetails) {
            this._initializeLayerDependantControls();
          }
        });
      },

      _initializeLayerDependantControls: function () {
        //Remove previous symbol
        this.config.myAssetSymbol = {};
        //Pass default symbol objects based on the geometry type
        if (this._selectedLayerDetails.geometryType === "esriGeometryPolygon") {
          this.config.myAssetSymbol = this._defaultPolygonSymbol;
        } else if (this._selectedLayerDetails.geometryType === "esriGeometryPolyline") {
          this.config.myAssetSymbol = this._defaultLineSymbol;
        } else {
          this.config.myAssetSymbol = this._defaultPointSymbol;
        }
        this._populateSymbolChooser();
        //If layers GUID field is selected, populate default actions
        if (this.foreignKeyFieldNode.get("value") !== "") {
          this._populateDefaultActions();
        }
        //Remove primary action configuration
        this._selectedPrimaryAction = null;
        //Remove all the additional actions
        this.config.actions.additionalActions = [];
        //Create actions as configured
        this._createActionsContainer();
        //Recreate primary status dropdown
        this._createPrimaryStatusRow();
        //Remove previous GP service from configuration
        this.txtURL.set('value', "");
      },

      /**
      * This function is used to fetch details of selected asset layer
      * @param{object} selectedLayerDetails : selected layer object
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _fetchAssetLayerDetails: function (selectedLayerDetails) {
        if (selectedLayerDetails) {
          this.config.assetLayerDetails.id = selectedLayerDetails.id;
          this.config.assetLayerDetails.url = selectedLayerDetails.url;
          this.config.assetLayerDetails.geometryType = selectedLayerDetails.geometryType;
        }
        this._setSelectedLayer(selectedLayerDetails);
        //Do the further processing only if valid layer is selected
        if (this._selectedLayerDetails) {
          //Populate all related GUID fields in the layer
          this._fetchGUIDFields();
          //Populate all related GUID fields in the layer
          this._fetchnickNameFields();
        }
      },

      /**
      * This function is used to set selected layer
      * @param{object} selectedLayerDetails : selected layer object
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _setSelectedLayer: function (selectedLayerDetails) {
        var layers, hasGUIDField = false;
        layers = this.map.webMapResponse.itemInfo.itemData.operationalLayers;
        array.some(layers, lang.hitch(this, function (currentLayer) {
          if (currentLayer.id === selectedLayerDetails.id) {
            //Check if selected layer has valid fields for further processing
            array.some(currentLayer.layerObject.fields, lang.hitch(this, function (currentField) {
              if (currentField.type === "esriFieldTypeGUID") {
                hasGUIDField = true;
              }
            }));
            if (hasGUIDField) {
              this._selectedLayerDetails = currentLayer.layerObject;
              this.itemSelectDiv.innerHTML = currentLayer.title;
            } else {
              this._errorMessage(this.nls.noGUIDFieldMsg);
            }
            return true;
          }
        }));
      },

      /**
      * This function is used to fetch all the fields with type GUID
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _fetchGUIDFields: function () {
        var dropDownOptions = [], option;
        if (this._selectedLayerDetails) {
          array.forEach(this._selectedLayerDetails.fields, lang.hitch(this, function (
            currentField) {
            if (currentField.type === "esriFieldTypeGUID") {
              option = { value: currentField.name, label: currentField.name };
              if (this.config.foreignKeyFieldForUserTable === currentField.name) {
                option.selected = "selected";
              }
              dropDownOptions.push(option);
            }
          }));
        }
        //Remove previous options
        this.foreignKeyFieldNode.options.length = 0;
        this.foreignKeyFieldNode.addOption(dropDownOptions);
        if (this.config.actions.assign.fieldsToUpdate.length === 0) {
          this._populateDefaultActions();
        }
        on(this.foreignKeyFieldNode, "change", lang.hitch(this, function () {
          this._populateDefaultActions();
        }));
      },

      _populateDefaultActions: function () {
        var defaultAssignAction = {}, defaultUnAssignAction = {};
        this.config.actions.assign.fieldsToUpdate = [];
        this.config.actions.unAssign.fieldsToUpdate = [];
        defaultAssignAction = {
          "field": this.foreignKeyFieldNode.get("value"),
          "action": "SetValue",
          "value": "{GlobalID}"
        };
        defaultUnAssignAction = {
          "field": this.foreignKeyFieldNode.get("value"),
          "action": "Clear"
        };
        this.config.actions.assign.fieldsToUpdate.push(defaultAssignAction);
        this.config.actions.unAssign.fieldsToUpdate.push(defaultUnAssignAction);
        //Create actions as configured
        this._createActionsContainer();
      },

      /**
      * This function is used to fetch all nick name fields
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _fetchnickNameFields: function () {
        var dropDownOptions = [{ value: "", label: this.nls.selectDefaultOptionText }], option;
        array.forEach(this._selectedLayerDetails.fields, lang.hitch(this, function (currentField) {
          if (currentField.type === "esriFieldTypeString") {
            option = { value: currentField.name, label: currentField.name };
            if (this.config.nickNameField === currentField.name) {
              option.selected = "selected";
            }
            dropDownOptions.push(option);
          }
        }));
        //Remove previous options
        this.nickNameFieldNode.options.length = 0;
        this.nickNameFieldNode.addOption(dropDownOptions);

      },

      /**
      * This function is used to fetch distance type
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _fetchDistanceType: function () {
        var distanceUnits = [], key, option;
        for (key in this.config.toleranceSettings.distanceSettings) {
          option = {
            value: this.config.toleranceSettings.distanceSettings[key],
            label: key
          };
          distanceUnits.push(option);
          if (this.config.toleranceSettings.distanceUnits === this.config.toleranceSettings
            .distanceSettings[key]) {
            option.selected = "selected";
          }
        }
        this.distanceUnitNode.addOption(distanceUnits);
      },

      /**
      * Create symbol chooser for selecting image
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _populateSymbolChooser: function () {
        //clean symbol chooser node
        domConstruct.empty(this.symbolChooserNode);
        domConstruct.empty(this.symbolChooserDimensionsNode);
        //If symbol chooser node is hidden, show it
        if (domClass.contains(this.myAssetSymbolNode, "esriCTHidden")) {
          domClass.remove(this.myAssetSymbolNode, "esriCTHidden");
        }
        if (this.config.assetLayerDetails.geometryType === "esriGeometryPoint") {
          this._createHighlighterImage();
          this._populateDimensionsNode();
        } else {
          //create line/polygon chooser based on the geometry types
          this._createSymbolPicker(this.symbolChooserNode, this.config.assetLayerDetails
            .geometryType);
        }
      },

      /**
      * Set task URL button click handler.
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _onChooseTaskClicked: function () {
        var args = {
          portalUrl: this.appConfig.portalUrl
        },
          gpSource = new GpSource(args),
          popup = new Popup({
            titleLabel: "Set Task",
            width: 850,
            height: 600,
            content: gpSource
          });

        this.own(on(gpSource, 'ok', lang.hitch(this, function (tasks) {
          if (tasks.length === 0) {
            popup.close();
            return;
          }
          this.txtURL.set('value', tasks[0].url);
          this._validateGPServiceURL();
          popup.close();
        })));
        this.own(on(gpSource, 'cancel', lang.hitch(this, function () {
          popup.close();
        })));
      },

      /**
      * This function will execute when user clicked on the "Set Task."
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _validateGPServiceURL: function () {
        this.gpServiceTasks = [];
        var requestArgs, gpTaskParameters = [];
        this.loading.show();
        if (this.map && this.map.itemInfo && this.map.itemInfo.itemData &&
          this.map.itemInfo.itemData.operationalLayers && (this.map.itemInfo
            .itemData.operationalLayers.length > 0)) {
          // if the task URL is valid
          this.url = this.txtURL.value;
          requestArgs = {
            url: this.url,
            content: {
              f: "json"
            },
            handleAs: "json",
            callbackParamName: "callback",
            timeout: 20000
          };
          esriRequest(requestArgs).then(lang.hitch(this, function (
            response) {
            // if response returned from the queried request
            if (response.hasOwnProperty("name")) {
              // if name value exist in response object
              if (response.name !== null) {
                gpTaskParameters = response.parameters;
                // if gpTaskParameters array is not null
                if (gpTaskParameters) {
                  this._validateGpTaskResponseParameters(
                    gpTaskParameters);
                }
              }
            } else {
              //this._refreshConfigContainer();
              this.loading.hide();
            }
          }), lang.hitch(this, function () {
            this._errorMessage(this.nls.validationErrorMessage.UnableToLoadGeoprocessError);
            //this._refreshConfigContainer();
            this.loading.hide();
          }));
        } else {
          this.loading.hide();
          this._errorMessage(this.nls.validationErrorMessage.webMapError);
        }
      },

      /**
      * This function Validates the gp task response parameters
      * @param{object} gpTaskParameters gp service response object
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _validateGpTaskResponseParameters: function (gpTaskParameters) {
        var recordSetValCheckFlag = true,
          inputParametersArr = [],
          inputGPParamFlag = true,
          errMsg;
        //Check if all the required parameters are present in selected GP service
        array.some(gpTaskParameters, lang.hitch(this, function (currentParameter) {
          if (this._gpServiceParameters.indexOf(currentParameter.name) === -1 &&
            currentParameter.name !== "Result") {
            recordSetValCheckFlag = false;
            return true;
          } else {
            if (currentParameter.name !== "Result") {
              inputParametersArr.push(currentParameter.name);
            }
          }
        }));
        // if number of input parameters is less than 1 or greater than 3 then set flag to false
        if (inputParametersArr.length !== 9) {
          inputGPParamFlag = false;
        }
        // check for valid GP Service
        if (recordSetValCheckFlag && inputGPParamFlag) {
          this.validConfig = true;
          //this._showTaskDetails(gpTaskParameters);
          this.loading.hide();
        } else {
          this.loading.hide();
          if (!inputGPParamFlag) {
            // if number of input parameters is less than 1 or greater than 3 then show error message
            errMsg = this.nls.gpService.invalidInputParameters;
          } else if (!recordSetValCheckFlag && !inputGPParamFlag) {
            // if the gp task's input parameters is less than 0 and greater than 3 then
            errMsg = this.nls.gpService.inValidGPService;
          }
          this.txtURL.set('value', "");
          this.url = "";
          this._errorMessage(errMsg);
        }
      },


      /**
      * This function creates color picker instance to select font color
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _createColorPicker: function () {
        var tablePreviwText, trPreviewText, tdPreviewText, tdSymbolNode,
          divPreviewText, colorPickerDivNode;
        tablePreviwText = domConstruct.create("table", {
          "cellspacing": "0",
          "cellpadding": "0"
        }, this.colorPickerNode);
        trPreviewText = domConstruct.create("tr", { "style": "height:30px" }, tablePreviwText);
        tdPreviewText = domConstruct.create("td", {}, trPreviewText);
        divPreviewText = domConstruct.create("div", {
        }, tdPreviewText);
        tdSymbolNode = domConstruct.create("td", {}, trPreviewText);
        //create content div for color picker node
        colorPickerDivNode = domConstruct.create("div", {
          "class": "esriCTColorChooserNode"
        }, tdSymbolNode);
        this._highlightColorPicker = new ColorPicker(null, domConstruct.create("div", {},
          colorPickerDivNode));
      },

      /**
      * this function instantiates the editor tool
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _initEditor: function () {
        this._initEditorPluginsCSS();
        this._editorObj = new Editor({
          plugins: [
            'bold', 'italic', 'underline', 'foreColor', 'hiliteColor',
            '|', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull',
            '|', 'insertOrderedList', 'insertUnorderedList', 'indent', 'outdent'
          ],
          extraPlugins: [
            '|', 'createLink', 'unlink', 'pastefromword', '|', 'undo', 'redo',
            '|', 'chooseImage', 'uploadImage', 'toolbarlinebreak',
            'fontName', 'fontSize', 'formatBlock'
          ]
        }, this.editor);
        html.setStyle(this._editorObj.domNode, {
          width: '100%',
          height: '100%'
        });
        this._editorObj.startup();

        if (has('ie') !== 8) {
          this._editorObj.resize({
            w: '100%',
            h: '100%'
          });
        } else {
          var box = html.getMarginBox(this.editorContainer);
          this._editorObj.resize({
            w: box.w,
            h: box.h
          });
        }
      },

      /**
      * This function loads the editor tool plugins CSS
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _initEditorPluginsCSS: function () {
        var head, tcCssHref, tcCss, epCssHref, epCss, pfCssHref, pfCss;
        head = document.getElementsByTagName('head')[0];
        tcCssHref = window.apiUrl + "dojox/editor/plugins/resources/css/TextColor.css";
        tcCss = dojoQuery('link[href="' + tcCssHref + '"]', head)[0];
        if (!tcCss) {
          utils.loadStyleLink("editor_plugins_resources_TextColor", tcCssHref);
        }
        epCssHref = window.apiUrl + "dojox/editor/plugins/resources/editorPlugins.css";
        epCss = dojoQuery('link[href="' + epCssHref + '"]', head)[0];
        if (!epCss) {
          utils.loadStyleLink("editor_plugins_resources_editorPlugins", epCssHref);
        }
        pfCssHref = window.apiUrl + "dojox/editor/plugins/resources/css/PasteFromWord.css";
        pfCss = dojoQuery('link[href="' + pfCssHref + '"]', head)[0];
        if (!pfCss) {
          utils.loadStyleLink("editor_plugins_resources_PasteFromWord", pfCssHref);
        }
      },

      /**
      * This function loads the editor tool plugins CSS
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _createHighlighterImage: function () {
        domConstruct.empty(this.symbolChooserNode);
        var height, width, pointSymbolNode, imageChooserCotnainer,
          showImageChooser;
        pointSymbolNode = domConstruct.create("div",
          { "class": "esriCTPreviewField" },
          this.symbolChooserNode);

        imageChooserCotnainer = domConstruct.create("div",
          { "class": "esriCTThumbnailImgDiv" },
          domConstruct.create("div", {}, this.symbolChooserNode));

        showImageChooser = domConstruct.create("img",
          { "class": "esriCTThumbnailImg" },
          imageChooserCotnainer);

        this.imageChooser = new ImageChooser({
          cropImage: false,
          displayImg: showImageChooser,
          goldenWidth: 50,
          goldenHeight: 50
        });
        aspect.after(this.imageChooser, "onImageChange", lang.hitch(this, function () {
          this.imageInfo.imageData = this.imageChooser.imageData;
        }));
        domClass.add(this.imageChooser.domNode, 'img-chooser');
        domConstruct.place(this.imageChooser.domNode, pointSymbolNode);
        if (this.imageInfo.hasOwnProperty("imageData")) {
          this._createImageFromData(this.imageInfo, showImageChooser);
        } else {
          this._createImageFromData(this.config.myAssetSymbol, showImageChooser);
        }
        if (this.config.myAssetSymbol.height &&
          this.config.myAssetSymbol.width) {
          height = this.config.myAssetSymbol.height;
          width = this.config.myAssetSymbol.width;
        } else {
          height = 50;
          width = 50;
        }
        domAttr.set(showImageChooser, 'height', height);
        domAttr.set(showImageChooser, 'width', width);
      },

      /**
      * This function icreates image from URL/imageData
      * @param {object} imageInfo : image data
      * @param {object} imageChooserNode : node in which image will be displayed
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _createImageFromData: function (imageInfo, imageChooserNode, isBeforeAction) {
        var baseURL,defaultImagePath = "/images/default.png";
        if (imageInfo && imageInfo && imageInfo.imageData) {
          // if "${appPath}" string found inside highlighter image data string
          if (imageInfo.imageData.indexOf(
            "${appPath}") > -1) {
            baseURL = this.folderUrl.slice(0, this.folderUrl.lastIndexOf(
              "widgets"));
            domAttr.set(imageChooserNode, 'src', string.substitute(
              imageInfo.imageData, {
                appPath: baseURL
              }));
          } else {
            domAttr.set(imageChooserNode, 'src', imageInfo
              .imageData);
          }
        } else {
          //Check for parameter and then set default image
          if (isBeforeAction !== undefined) {
            if (isBeforeAction) {
              defaultImagePath = "images/beforeAction.png";
            } else {
              defaultImagePath = "images/afterAction.png";
            }
          }
          this.thumbnailUrl = this.folderUrl + defaultImagePath;
          domAttr.set(imageChooserNode, 'src', this.thumbnailUrl);
        }
      },

      /**
      * Create height anf width textboxes for image dimensions
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _populateDimensionsNode: function () {
        var heightNodeContainer, widthNodeContainer;
        domConstruct.empty(this.symbolChooserDimensionsNode);
        //Create parent container height textbox
        heightNodeContainer = domConstruct.create("div", {
          "class": "esriCTLayerContainer row"
        }, this.symbolChooserDimensionsNode);
        domConstruct.create("div", {
          "class": "esriCTlabel esriCTLabelContainer",
          "innerHTML": this.nls.heightLabel
        }, heightNodeContainer);

        this.heightNodeTextInput = new NumberSpinner({
          constraints: { min: 20, max: 50, places: 0 },
          intermediateChanges: true,
          value: this.config.myAssetSymbol.height,
          required: true
        });
        this.heightNodeTextInput.placeAt(
          domConstruct.create("div", { "class": "esriCTFieldLeft" }, heightNodeContainer)
        );
        //Create parent container width textbox
        widthNodeContainer = domConstruct.create("div", {
          "class": "esriCTLayerContainer row"
        }, this.symbolChooserDimensionsNode);
        domConstruct.create("div", {
          "class": "esriCTlabel esriCTLabelContainer",
          "innerHTML": this.nls.widthLabel
        }, widthNodeContainer);

        this.widthNodeTextInput = new NumberSpinner({
          constraints: { min: 20, max: 50, places: 0 },
          intermediateChanges: true,
          value: this.config.myAssetSymbol.width,
          required: true
        });
        this.widthNodeTextInput.placeAt(
          domConstruct.create("div", { "class": "esriCTFieldLeft" }, widthNodeContainer)
        );
        //Listen for changes in inputs to change image size
        this._bindEvent();
      },

      /**
      * This function used for loading indicator
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _initLoading: function () {
        this.loading = new LoadingIndicator({
          hidden: true
        });
        this.loading.placeAt(this.domNode);
        this.loading.startup();
      },

      /**
      * This function used to add fields
      * @memberOf widgets/Adopta/setting/Settings.js
      */
      _onAddFieldClicked: function () {
        var tableField, param, popup;
        param = {
          nls: this.nls
        };
        //create instance for layer chooser widget
        tableField = new TableField(param);
        //open widget in jimu popup dialog
        popup = new Popup({
          titleLabel: this.nls.additionalFieldDisplayLabel,
          width: 500,
          height: 250,
          content: tableField
        });
        //event handlers for layer chooser widget
        tableField.onOKButtonClicked = lang.hitch(this, function () {
          var tableRows, isFieldExist = false;
          tableRows = this._displayFieldsTable.getData();
          array.some(tableRows, lang.hitch(this, function (currentRow) {
            if (currentRow) {
              if (currentRow.field === tableField.loginFieldInfo.field) {
                this._errorMessage(this.nls.tableField.duplicateFieldMsg);
                isFieldExist = true;
                return true;
              }
            }
          }));
          if (!isFieldExist) {
            this._displayFieldsTable.addRow({
              required: tableField.loginFieldInfo.required,
              field: tableField.loginFieldInfo.field,
              placeHolderText: tableField.loginFieldInfo.placeHolderText
            });
            popup.close();
          }
        });
        tableField.onCancelClick = lang.hitch(this, function () {
          popup.close();
        });
        tableField.showError = lang.hitch(this, function (message) {
          this._errorMessage(message);
        });
      },



      /*
      * This function is used to create table for additional login fields
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _createAdditionalLoginFieldsGrid: function () {
        var args, fields = [{
          name: 'field',
          title: this.nls.simpleTable.fieldNameLabel,
          type: 'text',
          editable: 'true',
          width: '230px'
        }, {
            name: 'placeHolderText',
            title: this.nls.simpleTable.hintTextLabel,
            type: 'text',
            editable: 'true',
            width: '150px'
          }, {
            name: 'required',
            title: this.nls.common.required,
            type: 'checkbox',
            'class': 'update',
            width: '120px'
          }, {
            name: 'actions',
            title: this.nls.simpleTable.actionLabel,
            width: '100px',
            type: 'actions',
            actions: ['up', 'down', 'delete']
          }];
        args = {
          fields: fields,
          selectable: false
        };
        this._displayFieldsTable = new SimpleTable(args);
        this._displayFieldsTable.placeAt(this.additionalFieldTableNode);
        this._displayFieldsTable.startup();
        this._createFieldsRows();
      },

      /**
      * This function used to create rows for fields in table
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _createFieldsRows: function () {
        var loginFields, i;
        loginFields = this.config && this.config.additionalLoginParameters;
        for (i = 0; i < loginFields.length; i++) {
          this._displayFieldsTable.addRow({
            required: loginFields[i].required,
            field: loginFields[i].field,
            placeHolderText: loginFields[i].placeHolderText
          });
        }
      },

      /**
      * This function used to create rows for fields in table
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _createActionsContainer: function () {
        var params = {};
        params = {
          config: this.config,
          map: this.map,
          selectedLayerDetails: this._selectedLayerDetails,
          nls: this.nls
        };
        this._createActionsNode(params);
      },

      /**
      * This function used to create entire actions node
      * @param {object} params : list of required params for actions widget
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _createActionsNode: function (params) {
        var widgetName;
        //Clear the domnode and actions object
        domConstruct.empty(this.actionsNode);
        this._actions = {};
        //Create assign action container
        if (this.config.actions.assign) {
          params.currentAction = this.config.actions.assign;
          //index is 0 becasue this is default action on first index
          params.index = 0;
          this._createActionWidgetInstance(params, params.currentAction.name);
          this._onConfigUpdate(params.currentAction.name);
        }
        //Create unassign action container
        if (this.config.actions.unAssign) {
          params.currentAction = this.config.actions.unAssign;
          //index is 1 becasue this is default action on second index
          params.index = 1;
          this._createActionWidgetInstance(params, params.currentAction.name);
          this._onConfigUpdate(params.currentAction.name);
        }

        //Create add action div and place it after assign and unassign actions
        this._createAddActionContainer(this._actions[params.currentAction.name]);

        array.forEach(this.config.actions.additionalActions, lang.hitch(this,
          function (currentAction, index) {
            currentAction.rowIndex = index;
            params.currentAction = currentAction;
            //The index is incremented by 2 beacuse of two default actions l.e. adopt and abandon
            params.index = index + 2;
            if (!params.currentAction.name) {
              widgetName = Date.now();
            } else {
              widgetName = params.currentAction.name;
              //Make sure the widgets pused in this._actions array does not contain same name
              if (this._actions.hasOwnProperty(widgetName)) {
                widgetName = widgetName + index;
              }
            }
            this._createActionWidgetInstance(params, widgetName);
            this._actions[widgetName].on("recreate", lang.hitch(this, function () {
              this._createActionsNode(params);
              this._createPrimaryStatusRow();
            }));
            this._onConfigUpdate(widgetName);
            this._actions[widgetName].on("populatePrimaryActions", lang.hitch(this, function () {
              this._updateActionsConfig();
              this._createPrimaryStatusRow();
            }));

            this._actions[widgetName].on("disablePrimaryActionsDropdown", lang.hitch(this,
              function () {
                if (this.primaryActionsDropDown) {
                  this.primaryActionsDropDown.set("disabled", true);
                }
              }));
          }));
      },

      _createActionWidgetInstance: function (params, widgetName) {
        params.actionKey = widgetName;
        params.reserveWebAppURLParams = this.reserveWebAppURLParams;
        params.integerTypeToBeValidated = this.integerTypeToBeValidated;
        this._actions[widgetName] = new Actions(params);
        this._actions[widgetName].placeAt(this.actionsNode);
        this._actions[widgetName].startup();
        on(this._actions[widgetName], "getAllUrlParams", lang.hitch(this,
          function (actionsIndex, isActionsLabel) {
            for (var key in this._actions) {
              if (!isActionsLabel) {
                var array = this.getAllUrlParamValues(actionsIndex);
                if (this._actions[key].index === actionsIndex) {
                  this._actions[key].setAllUrlParams(array);
                }
              } else {
                var labelArray = this.getAllActionLabelValues(actionsIndex);
                if (this._actions[key].index === actionsIndex) {
                  this._actions[key].setAllActionLabelParams(labelArray);
                }
              }
            }
          }));
      },

      _onConfigUpdate: function (widgetName) {
        this._actions[widgetName].on("fetchUpdatedConfig", lang.hitch(this, function () {
          this._updateActionsConfig();
        }));
      },

      /**
      * This function used to create dom node for additional actions
      * @param {object} actionsNode : parent node for additional actions
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _createAddActionContainer: function (actionsNode) {
        var addActionTextContainer, currentAction, addActionLabel, addActionSpanContainer;
        // domAttr.set(this.actionTitleNode, "innerHTML", this.nls.actions.assignStatusLabel);
        addActionTextContainer = domConstruct.create("div",
          {
            "class": "add-with-icon"
          }, null);
        addActionLabel = domConstruct.create("div",
          {
            "class": "esriCTStatusLabel",
            "innerHTML": this.nls.actions.statusLabel
          }, addActionTextContainer);
        addActionSpanContainer = domConstruct.create("span",
          {
            "class": "jimu-icon jimu-icon-add"
          }, addActionTextContainer);
        addActionSpanContainer = domConstruct.create("span",
          {
            "class": "add-label",
            "innerHTML": this.nls.actions.addStatusLabel
          }, addActionTextContainer);
        domConstruct.place(addActionTextContainer, actionsNode.domNode, "after");
        //add new action on click of add action  link
        on(addActionTextContainer, "click", lang.hitch(this, function () {
          //first fetch updated config of all the actions
          this._updateActionsConfig();
          var params = {
            config: this.config,
            map: this.map,
            selectedLayerDetails: this._selectedLayerDetails,
            nls: this.nls
          };
          currentAction = this._addNewAction();
          params.currentAction = currentAction;
          this._createActionsNode(params);
          this._createPrimaryStatusRow();
        }));
      },

      /**
      * This function used to add new action
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _addNewAction: function () {
        var newActionObj = {};
        newActionObj.name = "";
        newActionObj.urlParameterLabel = "";
        newActionObj.displayInMyAssets = false;
        newActionObj.fieldsToUpdate = [];
        this.config.actions.additionalActions.push(newActionObj);
        return newActionObj;
      },

      /**
      * This function loads the editor tool plugins CSS
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _createBeforeActionImage: function () {
        this.beforeActionImageChooser = new ImageChooser({
          cropImage: false,
          displayImg: this.beforeActionImageNode,
          goldenWidth: 50,
          goldenHeight: 50
        });
        domClass.add(this.beforeActionImageChooser.domNode, 'img-chooser');
        domConstruct.place(this.beforeActionImageChooser.domNode, this.pointSymbolImageNode);
        this._createImageFromData(this.config.beforeActionImage,
          this.beforeActionImageNode, true);
      },

      /**
      * This function loads the editor tool plugins CSS
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _createAfterActionImage: function () {
        this.afterActionImageChooser = new ImageChooser({
          cropImage: false,
          displayImg: this.afterActionImageNode,
          goldenWidth: 50,
          goldenHeight: 50
        });
        domClass.add(this.afterActionImageChooser.domNode, 'img-chooser');
        domConstruct.place(this.afterActionImageChooser.domNode, this.pointSymbolAfterImageNode);
        this._createImageFromData(this.config.afterActionImage,
          this.afterActionImageNode, false);
      },

      /**
      * This function creates error alert.
      * @param {string} err
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _errorMessage: function (err) {
        var errorMessage = new Message({
          message: err,
          buttons: [{
            "label": this.nls.common.ok
          }]
        });
        errorMessage.message = err;
      },

      /**
      * This function creates primary  status dropdown.
      * @memberOf widgets/Adopta/settings/Setting.js
      **/
      _createPrimaryStatusRow: function () {
        var primaryStatusDropdownContainer;
        if (!this.primaryActionsDropDown) {
          domConstruct.empty(this.primaryStatusContainerNode);
          primaryStatusDropdownContainer = domConstruct.create("div", {
            "class": "esriCTFieldsDropDown esirCTAdditionalActionsInfo"
          }, this.primaryStatusContainerNode);
          this.primaryActionsDropDown = new Select({}, null);
          this.primaryActionsDropDown.placeAt(primaryStatusDropdownContainer);
          on(this.primaryActionsDropDown, "change", lang.hitch(this, function (selectedValue) {
            //Remove previously saved primary action from the additional actions array
            if (this._selectedPrimaryAction) {
              array.some(this.config.actions.additionalActions, lang.hitch(this,
                function (currentAction, actionIndex) {
                  if (this._selectedPrimaryAction === currentAction.name &&
                    this.config.actions.additionalActions[actionIndex].hasOwnProperty(
                      "displayInMyAssets")) {
                    this.config.actions.additionalActions[actionIndex].displayInMyAssets = false;
                    return true;
                  }
                }));
            }
            this._selectedPrimaryAction = selectedValue;
          }));
        } else {
          this.primaryActionsDropDown.set("disabled", false);
          //Remove previous options
          this.primaryActionsDropDown.options.length = 0;
        }
        this._fetchPrimaryDropDownFields(this.primaryActionsDropDown);
      },

      /**
      * This function creates fetch primary  status in dropdown.
      * @memberOf widgets/Adopta/settings/Setting.js
      **/
      _fetchPrimaryDropDownFields: function (primaryActionsDropDown) {
        var fieldOptions = [{
            value: this.nls.selectDefaultOptionText,
            "label": this.nls.selectDefaultOptionText
          }],
          option;
        array.forEach(this.config.actions.additionalActions, lang.hitch(this, function (key) {
          //Check if action name is not EMPTY, valid and valid layer is selected
          if (key.name !== "" && this._selectedLayerDetails &&
            !this._isDuplicateAction(key.name, fieldOptions)) {
            option = { value: key.name, label: key.name };
            if (key.displayInMyAssets) {
              option.selected = true;
              this._selectedPrimaryAction = key.name;
            }
            fieldOptions.push(option);
          }
        }));
        primaryActionsDropDown.addOption(fieldOptions);
      },

      /**
      * This function checks for dulicate action label
      * @param {string} actionLabel: current actions label
      * @param {array} fieldOptions: array of all the action labels
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _isDuplicateAction: function (actionLabel, fieldOptions) {
        var isDuplicate = false;
        array.some(fieldOptions, lang.hitch(this, function (currentOption) {
          if (currentOption.label === actionLabel) {
            isDuplicate = true;
            return true;
          }
        }));
        return isDuplicate;
      },

      /* Section for symcol chooser */

      /**
      * This function creates symbols in config UI
      * @param {object} symbolNode: contains a symbol chooser node
      * @param {string} symbolType: contains symbol type
      * @param {string} geometryType: contains symbol geometry type
      * @param {string} symbolChooserTitle: contains a symbol chooser popup title
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _createSymbolPicker: function (symbolNode, geometryType) {
        var objSymbol, symbolChooserNode, params;
        //if symbol geometry exist
        if (geometryType) {
          objSymbol = {};
          objSymbol.type = utils.getSymbolTypeByGeometryType(geometryType);
          // if symbols parameter available in input parameters then take symbol details
          if (this.config && this.config.myAssetSymbol) {
            objSymbol.symbol = jsonUtils.fromJson(this.config.myAssetSymbol);
          }
          symbolChooserNode = this._createPreviewContainer(symbolNode);

          //create params to initialize 'symbolchooserPopup' widget
          params = {
            symbolChooserTitle: this.nls.symbolChooserTitleText,
            symbolParams: objSymbol,
            nls: this.nls
          };
          //display configured symbol in symbol chooser node
          this._showSelectedSymbol(symbolChooserNode, objSymbol.symbol);
          //attach 'click' event on node to display symbol chooser popup
          this.own(on(symbolChooserNode, 'click', lang.hitch(this, function () {
            //set recently selected symbol in symbol chooser popup
            objSymbol.symbol = jsonUtils.fromJson(this.config.myAssetSymbol);
            this._initSymbolChooserPopup(params, symbolChooserNode);
          })));
        }
      },

      /**
      * Create preview container to display selected symbol
      * @param {object} symbolNode: contains node to display selected graphic symbol
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _createPreviewContainer: function (symbolNode) {
        var tablePreviwText, trPreviewText, tdPreviewText, tdSymbolNode,
          divPreviewText, symbolChooserNode;
        tablePreviwText = domConstruct.create("table", {
          "cellspacing": "0",
          "cellpadding": "0"
        }, symbolNode);
        trPreviewText = domConstruct.create("tr", { "style": "height:30px" }, tablePreviwText);
        tdPreviewText = domConstruct.create("td", {}, trPreviewText);
        divPreviewText = domConstruct.create("div", {
          "innerHTML": this.nls.previewText,
          "class": "esriCTSymbolPreviewText"
        }, tdPreviewText);
        tdSymbolNode = domConstruct.create("td", {}, trPreviewText);
        //create content div for symbol chooser node
        symbolChooserNode = domConstruct.create("div", {
          "class": "esriCTSymbolChooserNode"
        }, tdSymbolNode);
        return symbolChooserNode;
      },

      /**
      * Initialize symbol chooser popup widget
      * @param {object} params: contains params to initialize widget
      * @param {object} symbolChooserNode: contains node to display selected graphic symbol
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _initSymbolChooserPopup: function (params, symbolChooserNode) {
        var symbolChooserObj = new SymbolChooserPopup(params);
        //handler for poopup 'OK' button 'click' event
        symbolChooserObj.onOkClick = lang.hitch(this, function () {
          //get selected symbol
          var symbolJson = symbolChooserObj.symbolChooser.getSymbol();
          this._showSelectedSymbol(symbolChooserNode, symbolJson);
          symbolChooserObj.popup.close();
        });
      },

      /**
      * show selected graphic symbol in symbol chooser node
      * @param {object} symbolChooserNode: contains a symbol chooser node
      * @param {object} symbolJson: contains a json structure for symbol
      * @param {string} symbolType: contains symbol type
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      _showSelectedSymbol: function (symbolChooserNode, symbolJson) {
        domConstruct.empty(symbolChooserNode);
        if (symbolJson) {
          var symbolNode = symbolUtils.createSymbolNode(symbolJson);
          // if symbol node is not created
          if (!symbolNode) {
            symbolNode = domConstruct.create('div');
          }
          domConstruct.place(symbolNode, symbolChooserNode);
          //store selected symbol in 'symbolParams' object
          this.config.myAssetSymbol = symbolJson.toJson();
        }
      },

      /* End of section for symbol chooser */

      /* Section for validating actions label and url parameter */
      /**
      * fetch url paramertes for all configurefd actions
      * @param {string} excludeActionIndex: index to be excluded
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      getAllUrlParamValues: function (excludeActionIndex) {
        var urlParamsArray = [], actionsKey;
        for (actionsKey in this._actions) {
          if (this._actions[actionsKey].index !== excludeActionIndex) {
            urlParamsArray.push(this._actions[actionsKey].getUrlParamValue());
          }
        }
        return urlParamsArray;
      },

      /**
      * fetch action labels for all configures actions
      * @param {string} excludeActionIndex: index to be excluded
      * @memberOf widgets/Adopta/setting/Settings.js
      **/
      getAllActionLabelValues: function (excludeActionIndex) {
        var urlActionLabelArray = [], actionsKey;
        for (actionsKey in this._actions) {
          if (this._actions[actionsKey].index !== excludeActionIndex) {
            urlActionLabelArray.push(this._actions[actionsKey].getActionLabelValue());
          }
        }
        return urlActionLabelArray;
      }
      /* End of section for validating actions label and url parameter */
    });
});