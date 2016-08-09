///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
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
  'jimu/BaseWidgetSetting',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/_base/lang',
  'dojo/on',
  'dojo/text!./TableField.html',
  'dojo/domReady!'
], function (
  declare,
  BaseWidgetSetting,
  _WidgetsInTemplateMixin,
  lang,
  on,
  tableFieldTemplate
) {
  return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      baseClass: 'jimu-widget-adopta-setting',
      templateString: tableFieldTemplate,
      loginFieldInfo: {},
      startup: function () {
        this.inherited(arguments);
      },

      postCreate: function () {
        this.own(on(this.cancelButton, 'click', lang.hitch(this,
          function (evt) {
            this.onCancelClick(evt);
          })));
        this.own(on(this.okButton, 'click', lang.hitch(this, function (evt) {
          if (lang.trim(this.fieldNameNode.get("value")) !== "") {
            this.loginFieldInfo.required = this.requiredNode.getValue();
            this.loginFieldInfo.field = this.fieldNameNode.get("value");
            this.loginFieldInfo.placeHolderText = this.hintTextNode.get("value");
            this.onOKButtonClicked(evt);
          } else {
            this.showError(this.nls.tableField.emptyFieldNameMsg);
          }
        })));
      },

      /**
      * Event which will be generated on clicking cancel button
      * @param {object} evt
      * @memberOf widgets/Adopta/settings/TableField.js
      **/
      onOKButtonClicked: function (evt) {
        return evt;
      },

      /**
      * Event which will be generated on clicking cancel button
      * @param {object} evt
      * @memberOf widgets/Adopta/settings/TableField.js
      **/
      onCancelClick: function (evt) {
        return evt;
      },

      /**
      * Event which will be generated when field name is empty
      * @param {string} message
      * @memberOf widgets/Adopta/settings/TableField.js
      **/
      showError : function (msg) {
        return msg;
      }
    });
});


