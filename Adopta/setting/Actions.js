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
  'dojo/Evented',
  'dojo/_base/declare',
  'jimu/BaseWidgetSetting',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dijit/registry',
  'dojo/dom-class',
  'dojo/dom-attr',
  'dojo/dom-construct',
  'dojo/on',
  'dojo/query',
  'dojo/string',
  'dijit/form/Select',
  'dijit/form/TextBox',
  'dijit/form/ValidationTextBox',
  'dijit/form/NumberTextBox',
  'dojo/text!./Actions.html'
], function (
  Evented,
  declare,
  BaseWidgetSetting,
  _WidgetsInTemplateMixin,
  lang,
  array,
  registry,
  domClass,
  domAttr,
  domConstruct,
  on,
  dojoQuery,
  string,
  Select,
  TextBox,
  ValidationTextBox,
  NumberTextBox,
  actionsTemplate
) {
  return declare([BaseWidgetSetting, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'jimu-widget-adopta-actions',
      templateString: actionsTemplate,
      fieldOptions: [],
      allUrlParam: [],
      allActionLabelParam:[],
      fieldActions: [
        {
          "value": "SetDate",
          "label": "SetDate"
        },
        {
          "value": "Clear",
          "label": "Clear"
        }, {
          "value": "SetValue",
          "label": "SetValue"
        }],
      typeToBeSkiped: ["esriFieldTypeOID", "esriFieldTypeGeometry",
        "esriFieldTypeBlob", "esriFieldTypeRaster", "esriFieldTypeGUID",
        "esriFieldTypeGlobalID", "esriFieldTypeXML"
      ],

      postCreate: function () {
      },

      startup: function () {
        //Fill label and URL parameter of actions
        this._fetchParameters();
        this._setLegendLabel();
        if (this.selectedLayerDetails) {
          //Create a dom for containing enter actions container
          //populate additional fields with values
          this._populateAdditionalFields(this.additionalActionContainer);
          //Create Navigation Arrows
          this._createNavigationArrows();
          //Listen for text change event
          on(this.actionsLabelNode, "keyup", lang.hitch(this, function () {
            //Disable primary actions dropdown when user interacts with textbox
            this.emit("disablePrimaryActionsDropdown");
            this._setLegendLabel();
          }));
          //Listen for content paste event
          on(this.actionsLabelNode, "paste", lang.hitch(this, function () {
            //Set negligible timeout to make sure we access the text only after it is entered in the textbox
            setTimeout(lang.hitch(this, function () {
              this._setLegendLabel();
            }), 0);
          }));
          //Add new row in the additional action
          on(this.addActionsLink, "click", lang.hitch(this, function () {
            this._createAdditionalActionRow(null, this.additionalActionContainer, null);
          }));
        }
      },

      /**
      * Set label to field set legend
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _setLegendLabel: function () {
        domAttr.set(this.legendsNode, "innerHTML", string.substitute(this.nls.actions
          .legendLabel, {
            action: this.actionsLabelNode.getValue()
          }));
        //set innerHTML to title node
        if (this.index === 0) {
          domAttr.set(this.actionTitleNode, "innerHTML", this.nls.actions.assignStatusLabel);
        } else if (this.index === 1) {
          domAttr.set(this.actionTitleNode, "innerHTML", this.nls.actions.unassignStatusLabel);
        }
      },

      /**
      * Create navigation arrows to change the position of actions
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _createNavigationArrows : function () {
        var upDownArrowsContainer, upArrowContainer, downArrowContainer,
          deleteActionContainer, upDownArrowsContent, canCreate = true, actionsInfo;
        if (this.index === 0 || this.index === 1) {
          canCreate = false;
        }
        if (canCreate) {
          actionsInfo = this._fetchCurrentActionsIndex();
          upDownArrowsContainer = domConstruct.create("div", {
            "class": "esriCTFullWidth"
          }, null);
          domConstruct.place(upDownArrowsContainer, this.legendsNode, "after");
          upDownArrowsContent = domConstruct.create("div", {
            "class": "esriCTUpDownDeleteContainer"
          }, upDownArrowsContainer);

          //Create up arrow container
          upArrowContainer = domConstruct.create("div", {
            "class": "esriCTNavigationControls esriCTUpArrowImg esriCTNavigationImagesDimension",
            "title": this.nls.actions.moveUpTitle
          }, upDownArrowsContent);
          domAttr.set(upArrowContainer, "currentAction", this.currentAction.name);

          //Create down arrow container
          downArrowContainer = domConstruct.create("div", {
            "class": "esriCTNavigationControls esriCTDownArrowImg esriCTNavigationImagesDimension",
            "title": this.nls.actions.moveDownTitle
          }, upDownArrowsContent);
          domAttr.set(downArrowContainer, "currentAction", this.currentAction.name);
          //Bind events to buttons based on the action index
          if (actionsInfo.status === "first") {
            this._bindNavigationEvents(downArrowContainer, actionsInfo, false);
            domClass.replace(upArrowContainer, "esriCTUpArrowImgDisabled", "esriCTUpArrowImg");
          } else if (actionsInfo.status === "last") {
            this._bindNavigationEvents(upArrowContainer, actionsInfo, true);
            domClass.replace(downArrowContainer, "esriCTDownArrowImgDisabled",
              "esriCTDownArrowImg");
          } else if (actionsInfo.status === "single") {
            domClass.replace(upArrowContainer, "esriCTUpArrowImgDisabled", "esriCTUpArrowImg");
            domClass.replace(downArrowContainer, "esriCTDownArrowImgDisabled",
              "esriCTDownArrowImg");
          } else {
            this._bindNavigationEvents(downArrowContainer, actionsInfo, false);
            this._bindNavigationEvents(upArrowContainer, actionsInfo, true);
          }
          //Create delete container
          deleteActionContainer = domConstruct.create("div", {
            "class": "esriCTNavigationControls esriCTNavigationImagesDimension esriCTDeleteImg",
            "title": this.nls.common.deleteText
          }, upDownArrowsContent);

          //Delete selected action on click of delete button
          on(deleteActionContainer, "click", lang.hitch(this, function () {
            this.config.actions.additionalActions.splice(actionsInfo.index, 1);
            this.emit("recreate");
          }));
        }
      },

      /**
      * Listen for navigation arrows click event
      * @param {object} node: navigation arrows node
      * @param {object} actionsInfo: current actions object
      * @param {boolean} isUpArrowClicked: flag for up/down arrow
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _bindNavigationEvents : function (node, actionsInfo, isUpArrowClicked) {
        //Handle clicks for navigation controls
        on(node, "click", lang.hitch(this, function (evt) {
          var action;
          action = domAttr.get(evt.currentTarget, "currentAction");
          this.emit("fetchUpdatedConfig");
          this._toggleActionsInArray(actionsInfo.index, isUpArrowClicked);
        }));
      },

      /**
      * Function returns index of current action in actions array
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _fetchCurrentActionsIndex : function () {
        var position, actionIndex;
        array.some(this.config.actions.additionalActions, lang.hitch(this, function (
          currentAction, index) {
          /* jshint unused: false */
          if (this.currentAction.rowIndex === index) {
            actionIndex = index;
            if (index === 0 && index === this.config.actions.additionalActions.length - 1) {
              //Only one action is configured
              position = "single";
              return true;
            } else if (index === 0) {
              //Selected action is at first index
              position = "first";
              return true;
            } else if (index === this.config.actions.additionalActions.length - 1) {
              //Selected action is at last index
              position = "last";
              return true;
            } else {
              //Selected action is in between in array
              position = "inbetween";
              return true;
            }
          }
        }));
        return { "index": actionIndex, "status": position };
      },

      /**
      * Find which elements in an array needs change in position
      * @param {string} index: current action index
      * @param {boolean} isUpArrowClicked: flag for up/down arrow
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _toggleActionsInArray : function (index, isUpArrowClicked) {
        var newIndex;
        if (isUpArrowClicked) {
          newIndex = index - 1;
        } else {
          newIndex = index + 1;
        }
        this._swapElements(this.config.actions.additionalActions, index, newIndex);
      },

      /**
      * Swap array elements and update the configuration
      * @param {array} actionsArray: actions array to be updated
      * @param {object} firstElement: first array element
      * @param {object} secondElement: second array element
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _swapElements: function (actionsArray, firstElement, secondElement) {
        var temp;
        temp = actionsArray[firstElement];
        actionsArray[firstElement] = actionsArray[secondElement];
        actionsArray[secondElement] = temp;
        //After performing operations on array, recreate the actions container
        this.emit("recreate");
      },

      /**
      * Fetch and populate required values on input
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _fetchParameters: function () {
        this.actionsLabelNode.set("value", this.currentAction.name);
        this.actionsURLParameterNode.set("value", this.currentAction.urlParameterLabel);

        if (this.index === 0 || this.index === 1) {
          this.actionsURLParameterNode.set("disabled", true);
        }
        //Save configuration values on blur of action label and url parameter
        on(this.actionsLabelNode, "blur", lang.hitch(this, function () {
          this.emit("populatePrimaryActions");
        }));
        on(this.actionsURLParameterNode, "blur", lang.hitch(this, function () {
          this.emit("fetchUpdatedConfig");
        }));
        //Add validator and listen for focus event
        this.actionsURLParameterNode.validator = lang.hitch(this, this._urlParamValidator);
        on(this.actionsURLParameterNode, "focus", lang.hitch(this, function () {
          this.emit("getAllUrlParams", this.index, false);
        }));
        this.actionsLabelNode.validator = lang.hitch(this, this._actionsNameValidator);
        on(this.actionsLabelNode, "focus", lang.hitch(this, function () {
          this.emit("getAllUrlParams", this.index, true);
        }));
      },

      /**
      * Populate additional fields based on configuration
      * @param {object} domContainer: parent node for additional actions
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _populateAdditionalFields: function (domContainer) {
        array.forEach(this.currentAction.fieldsToUpdate, lang.hitch(this,
          function (currentAction, index) {
            this._createAdditionalActionRow(currentAction, domContainer, index);
          }));
      },

      /**
      * Create new additional row on click of add row
      * @param {object} currentAction: selected actions object
      * @param {object} domContainer: parent node for additional actions
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _createAdditionalActionRow: function (currentAction, domContainer, actionIndex) {
        var actionsInfoContainer;
        //Create container for holding all the content of actions
        actionsInfoContainer = domConstruct.create("div", {
          "class": "esriCTAdditionalActionInfo"
        }, domContainer);
        if (this.selectedLayerDetails) {
          //If action is assign/unassign and index is 0 populate default additional action
          if ((this.index === 0 || this.index === 1) && actionIndex === 0) {
            this._createDefaultAdditionalAction(currentAction, actionsInfoContainer);
          } else {
            //Create dropdown and populate all the valid fields for user selection
            this._createFieldsDropDown(currentAction, actionsInfoContainer);
            //Create dropdown for all the actions
            this._createActionsDropDown(currentAction, actionsInfoContainer);
            if (actionIndex === null) {
              //Create close button container
              this._createCloseButtonContainer(actionsInfoContainer);
            } else if ((this.index === 0 || this.index === 1) && actionIndex > 0) {
              //Create close button container
              this._createCloseButtonContainer(actionsInfoContainer);
            }
            else if (this.index !== 0 || this.index !== 1) {
              this._createCloseButtonContainer(actionsInfoContainer);
            }
          }
        }
      },

      _createDefaultAdditionalAction: function (currentAction, actionsInfoContainer) {
        var fieldTextInput, actionTextInput, valueTextInput;

        fieldTextInput = new TextBox({
          "value": currentAction.field,
          "disabled": true,
          "class":"esriCTFieldSelectInput"
        });
        fieldTextInput.placeAt(domConstruct.create("div", {
          "class": "esriCTFieldsDropDown"
        }, actionsInfoContainer));

        actionTextInput = new TextBox({
          "value": currentAction.action,
          "disabled": true,
          "class": "esriCTActionSelectInput"
        });
        actionTextInput.placeAt(domConstruct.create("div", {
          "class": "esriCTFieldsDropDown"
        }, actionsInfoContainer));

        if (currentAction.action === "SetValue") {
          valueTextInput = new TextBox({
            "value": "{GlobalID}",
            "disabled": true,
            "class": "esriCTActionInputValue"
          });
          valueTextInput.placeAt(domConstruct.create("div", {
            "class": "esriCTFieldsDropDown"
          }, actionsInfoContainer));

        }
      },

      /**
      * Create drop down control for all the valid layer fields
      * @param {object} currentAction: selected actions object
      * @param {object} actionsInfoContainer: parent node for placing additional actions
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _createFieldsDropDown: function (currentAction, actionsInfoContainer) {
        var dropdownContainer, fieldsDropDown;
        dropdownContainer = domConstruct.create("div", {
          "class": "esriCTFieldsDropDown"
        }, actionsInfoContainer);
        fieldsDropDown = new Select({ "class": "esriCTFieldSelectInput" }, null);
        fieldsDropDown.placeAt(dropdownContainer);
        fieldsDropDown.addOption(this.fieldOptions);
        if (this.selectedLayerDetails) {
          this._fetchLayerFields(fieldsDropDown, currentAction);
        }
        //Reset actions dropdown on fields dropdown change
        on(fieldsDropDown, "change", lang.hitch(this, function () {
          if (currentAction) {
            currentAction.value = "";
            currentAction.action = "";
          }
          //Create dropdown for all the actions
          this._createActionsDropDown(currentAction, actionsInfoContainer);
        }));
      },

      /**
      * Create drop down control for all the actions fields
      * @param {object} currentAction: selected actions object
      * @param {object} actionsInfoContainer: parent node for placing additional actions
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _createActionsDropDown: function (currentAction, actionsInfoContainer) {
        var actionDropdownContainer, actionsDropDown;
        //Delete previous action control
        if (dojoQuery(".esriCTActionsDropDown", actionsInfoContainer)[0]) {
          domConstruct.destroy(dojoQuery(".esriCTActionsDropDown", actionsInfoContainer)[0]);
        }
        actionDropdownContainer = domConstruct.create("div", {
          "class": "esriCTFieldsDropDown esriCTActionsDropDown"
        }, actionsInfoContainer);
        actionsDropDown = new Select({ "class": "esriCTActionSelectInput" }, null);
        actionsDropDown.placeAt(actionDropdownContainer);
        this._fetchActionFields(actionsDropDown, currentAction, actionsInfoContainer);
        on(actionsDropDown, "change", lang.hitch(this, function (selectedValue) {
          //bind on change event of actions drop down
          this._onFieldActionChange(selectedValue, actionsInfoContainer);
        }));
      },

      /**
      * Create drop down control for all the actions fields
      * @param {object} selectedValue: selected value from input field
      * @param {object} actionsInfoContainer: parent node for placing additional actions
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _onFieldActionChange: function (selectedValue, actionsInfoContainer) {
        if (selectedValue === "SetValue") {
          this._createInputField(null, actionsInfoContainer);
        } else {
          //Delete input control
          this._deleteInputField(actionsInfoContainer);
        }
      },

      /**
      * Create delete button node and listen for the delete row event
      * @param {object} actionsInfoContainer: parent node for placing additional actions
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _createCloseButtonContainer: function (actionsInfoContainer) {
        var closeButtonContainer, closeButton;
        closeButtonContainer = domConstruct.create("div", { "class": "esriCTActionClose" });
        domConstruct.place(closeButtonContainer, actionsInfoContainer, "last");
        closeButton = domConstruct.create("div", {
          "class": "esriCTActionCloseImage",
          "title": this.nls.actions.deleteActionTooltip
        }, closeButtonContainer);
        on(closeButtonContainer, "click", lang.hitch(this, function () {
          //Delete enter action
          this._deleteAction(actionsInfoContainer);
        }));
      },

      /**
      * Fetch all valid layer fields
      * @param {object} dropDown: dropdown in which options needs to be added
      * @param {object} currentAction: selected actions object
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _fetchLayerFields: function (dropDown, currentAction) {
        var fieldOptions = [], option;
        array.forEach(this.selectedLayerDetails.fields, lang.hitch(this,
          function (currentField) {
            if (this.typeToBeSkiped.indexOf(currentField.type) === -1) {
              option = { value: currentField.name, label: currentField.alias };
              if (currentAction && currentAction.field === currentField.name) {
                option.selected = true;
              }
              fieldOptions.push(option);
            }
          }));
        dropDown.addOption(fieldOptions);
      },

      /**
      * Fetch all valid actions fields
      * @param {object} dropDown: dropdown in which options needs to be added
      * @param {object} currentAction: selected actions object
      * @param {object} actionsInfoContainer: parent node for placing additional actions
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _fetchActionFields: function (dropDown, currentAction, actionsInfoContainer) {
        var fieldOptions = [], option, fieldObj, filteredActionsArray;
        //get selected field object for filtering actions
        fieldObj = this._getSelectedFieldForAction(actionsInfoContainer);
        //Filter action array to populate valid actions for field
        filteredActionsArray = this._filterActionsFromFieldType(fieldObj);
        array.forEach(filteredActionsArray, lang.hitch(this,
          function (action) {
            option = { value: action.value, label: action.label };
            if (currentAction && currentAction.action === action.value) {
              option.selected = true;
            }
            fieldOptions.push(option);
          }));
        //If action is setValue then show text box with predefined value
        if (currentAction && currentAction.action === "SetValue") {
          this._createInputField(currentAction, actionsInfoContainer);
        } else {
          //Delete previously created control for setValue action
          this._deleteInputField(actionsInfoContainer);
        }
        dropDown.addOption(fieldOptions);
      },

      /**
      * Get selected field
      * @param {object} actionsInfoContainer: parent node for placing additional actions
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _getSelectedFieldForAction: function (actionsInfoContainer) {
        var selectedField, fieldObj;
        if (dojoQuery(".esriCTFieldSelectInput", actionsInfoContainer)[0]) {
          selectedField = registry.byNode(dojoQuery(".esriCTFieldSelectInput",
            actionsInfoContainer)[0]).getValue();
          array.some(this.selectedLayerDetails.fields, lang.hitch(this, function (currentField) {
            if (currentField.name === selectedField) {
              fieldObj = currentField;
              return true;
            }
          }));
        }
        return fieldObj;
      },

      /**
      * Filter actions that can be applied to field based on field type
      * @param {object} fieldObj: fields object
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _filterActionsFromFieldType: function (fieldObj) {
        var actionsArray = [];
        actionsArray = lang.clone(this.fieldActions);
        //Filter actions based on data type
        if (this.integerTypeToBeValidated.indexOf(fieldObj.type) > -1 ||
          fieldObj.type === "esriFieldTypeString") {
          actionsArray.splice(0, 1);
        } else if (fieldObj.type === "esriFieldTypeDate") {
          actionsArray.splice(2, 1);
        }
        if (!fieldObj.nullable) {
          //Loop through the actions array to check for nullable fields
          array.some(actionsArray, lang.hitch(this, function (currentAction, index) {
            if (currentAction.value === "Clear") {
              actionsArray.splice(index, 1);
              return true;
            }
          }));
        }
        return actionsArray;
      },

      /**
      * Create text input field
      * @param {object} currentAction: selected actions object
      * @param {object} actionsInfoContainer: parent node for placing additional actions
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _createInputField: function (currentAction, actionsInfoContainer) {
        var textActionInput, inputDropdownContainer, domainStatus, option, actionsOptionArray = [],
        fieldsObj;
        //if previous controls are present,destroy them
        this._deleteInputField(actionsInfoContainer);
        inputDropdownContainer = domConstruct.create("div", {
          "class": "esriCTFieldsDropDown esriCTInputValue"
        }, actionsInfoContainer);
        domainStatus = this._checkFieldType(actionsInfoContainer);
        if (domainStatus.isDomainField) {
          textActionInput = new Select({ "class": "esriCTActionSelectInputValue" });
          array.forEach(domainStatus.domain.codedValues, lang.hitch(this,
            function (currentDomain) {
              option = { label: currentDomain.name, value: currentDomain.code };
              if (currentAction && currentAction.value === currentDomain.code) {
                option.selected = true;
              }
              actionsOptionArray.push(option);
            }));
          textActionInput.addOption(actionsOptionArray);
        } else {
          fieldsObj = this._getSelectedFieldForAction(actionsInfoContainer);
          //Create numeric text box for integer fields and validation text box for string fields
          if (this.integerTypeToBeValidated.indexOf(fieldsObj.type) > -1) {
            textActionInput = new NumberTextBox(
              {
                "class": "esriCTActionInputValue",
                "required": true,
                "invalidMessage": this.nls.actions.invalidNumericValue
              });
          } else {
            textActionInput = new ValidationTextBox(
              {
                "class": "esriCTActionInputValue",
                "required": true
              });
          }
          //set fields max length to textbox to prevent user from entering invalid values
          if(fieldsObj.length){
            textActionInput.set("maxLength", fieldsObj.length);
          }
          if (currentAction && currentAction.value) {
            textActionInput.set("value", currentAction.value);
          }
        }
        textActionInput.placeAt(inputDropdownContainer);
      },

      /**
      * Check for domain field
      * @param {object} actionsInfoContainer: parent node for placing additional actions
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _checkFieldType: function (actionsInfoContainer) {
        var isDomainField = false, fieldsSelectInput, fieldsSelectInputValue, domain = [];
        fieldsSelectInput = dojoQuery(".esriCTFieldSelectInput", actionsInfoContainer)[0];
        if (fieldsSelectInput && fieldsSelectInputValue !== "") {
          fieldsSelectInputValue = registry.byNode(fieldsSelectInput).getValue();
          array.some(this.selectedLayerDetails.fields, lang.hitch(this, function (currentField) {
            if (currentField.name === fieldsSelectInputValue && currentField.domain) {
              domain = currentField.domain;
              isDomainField = true;
            }
          }));
        }
        return {
          isDomainField: isDomainField,
          domain: domain,
          fieldsSelectInputValue: fieldsSelectInputValue
        };
      },

      /**
      * Delete text input/select input field
      * @param {object} actionsInfoContainer: parent node for placing additional actions
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _deleteInputField: function (actionsInfoContainer) {
        var textBoxParentNode;
        textBoxParentNode = dojoQuery(".esriCTInputValue", actionsInfoContainer);
        if (textBoxParentNode[0]) {
          domConstruct.destroy(textBoxParentNode[0]);
        }
      },

      /**
      * Delete selected action
      * @param {object} actionsInfoContainer: parent node for placing additional actions
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _deleteAction: function (actionsInfoContainer) {
        domConstruct.destroy(actionsInfoContainer);
      },

      /**
      * returns current configuration of widget
      * @param {string} primaryAction: selected primary action
      * @memberOf widgets/adopta/settings/Actions.js
      */
      getConfig: function (primaryAction, actionIndex) {
        var configuration, additionalActionsArray = [],
          actionObj, selectInput, textInput, actionTextInput, isPrimaryAction = false,
          actionSelectInput;
        array.forEach(this.additionalActionContainer.children, lang.hitch(this,
          function (currentActionRow) {
            actionObj = {};
            if (dojoQuery(".esriCTFieldSelectInput", currentActionRow)[0]) {
              selectInput = dojoQuery(".esriCTFieldSelectInput", currentActionRow)[0];
              actionObj.field = registry.byNode(selectInput).getValue();
            }

            if (dojoQuery(".esriCTActionSelectInput", currentActionRow)[0]) {
              textInput = dojoQuery(".esriCTActionSelectInput", currentActionRow)[0];
              actionObj.action = registry.byNode(textInput).getValue();
            }

            if (actionObj.action === "SetValue" &&
              dojoQuery(".esriCTActionInputValue", currentActionRow)[0]) {
              actionTextInput = dojoQuery(".esriCTActionInputValue", currentActionRow)[0];
              actionObj.value = registry.byNode(actionTextInput).getValue();
            } else if (actionObj.action === "SetValue" &&
              dojoQuery(".esriCTActionSelectInputValue", currentActionRow)[0]) {
              actionSelectInput = dojoQuery(".esriCTActionSelectInputValue", currentActionRow)[0];
              actionObj.value = registry.byNode(actionSelectInput).getValue();
            }
            additionalActionsArray.push(actionObj);
          }));

        //Check if current action is set as primary action and change the flag value to true
        if (this.actionsLabelNode.getValue() === primaryAction) {
          isPrimaryAction = true;
        }
        configuration = {
          "name": this.actionsLabelNode.getValue(),
          "urlParameterLabel": this.actionsURLParameterNode.getValue(),
          "fieldsToUpdate": additionalActionsArray
        };
        //Add primary action parameter for additional actions
        if (actionIndex && actionIndex !== 0 && actionIndex !== 1) {
          configuration.displayInMyAssets = isPrimaryAction;
        }
        return configuration;
      },

      /* Validators section for action label and actions url parameter */

      /**
      * Validate url parameters
      * @param {string} url parameter value
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _urlParamValidator: function (value) {
        var urlParamsPattern = /^((?:[a-zA-Z0-9]+|[.]|[-]|[~]|[_])+)$/,
          regEx = new RegExp(urlParamsPattern);
        // Check for empty url parameter
        if (value === "") {
          return false;
        }
        //If URL parameter is not EMPTY, check if entered URL parameter does not conflicts with default reserved web app builder parameters
        if (this.reserveWebAppURLParams.indexOf(value) !== -1) {
          this.actionsURLParameterNode.invalidMessage = this.nls.actions.reservedURLParam;
          return false;
        }
        //Check for valid characters allowed in url parameter
        if (!regEx.exec(value)) {
          this.actionsURLParameterNode.invalidMessage = this.nls.actions.illegalCharacter;
          return false;
        }
        //Check for duplicate url parameter
        if (this.allUrlParam.indexOf(value) > -1) {
          this.actionsURLParameterNode.invalidMessage = this.nls.actions.duplicateURL;
          return false;
        }
        return true;
      },

      /**
      * Validate actions label
      * @param {string} actions label value
      * @memberOf widgets/adopta/settings/Actions.js
      */
      _actionsNameValidator: function (value) {
        //Check for empty actions label
        if (value === "") {
          return false;
        }
        //Check for duplicate actions label
        if (this.allActionLabelParam.indexOf(value) > -1) {
          this.actionsLabelNode.invalidMessage = this.nls.actions.duplicateAction;
          return false;
        }
        return true;
      },

      getUrlParamValue: function () {
        return this.actionsURLParameterNode.getValue();
      },

      getActionLabelValue: function () {
        return this.actionsLabelNode.getValue();
      },

      setAllUrlParams: function (urlParamsArray) {
        this.allUrlParam = urlParamsArray;
      },

      setAllActionLabelParams: function (actionLabelParamsArray) {
        this.allActionLabelParam = actionLabelParamsArray;
      }

      /* Validators section for action label and actions url parameter */
    });
});