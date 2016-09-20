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

define({
  root: ({
      "widgetSettingTabTitle" : "Layer and Authentication settings", //shown as string a tab title
      "assetLayerLabel": "Asset layer", // shown as a label in config UI for asset layer.
      "assetLayerHintText": "Hint: Select asset layer from map. Please ensure the same layer is configured in authentication GP service.", // Shown as a hint text in config UI for asset layer.
      "selectAssetLayerLabel": "Select asset layer", // shown as a label in config UI for layer chooser.
      "selectAssetLayerHintText" : "Hint: Select layer to be used as asset layer in widget",//Shown as hint in layer chooser
      "emptyAssetLayerFieldValueMsg": "Asset layer cannot be Empty", // Shown as error message when distance is empty.
      "assetKeyFieldLabel": "Asset key field", // shown as a label in config UI for asset key field.
      "assetKeyFieldHintText": "Hint: Select foreign key field that relates to user table.", // Shown as a hint text in config UI for asset key field.
      "emptyAssetKeyFieldValueMsg": "Asset key cannot be Empty", // Shown as error message when distance is empty.
      "assetNicknameFieldLabel": "Asset nickname field", // shown as a label in config UI for asset nickname field.
      "assetNicknameFieldHintText": "Hint: Select field from asset layer. Used to store nickname of asset.", // Shown as a hint text in config UI for nickname field.
      "emptyNicknameFieldValueMsg": "Nickname cannot be Empty", // Shown as error message when nickname is empty.
      "authenticationGPServiceLabel": "Authentication GP service", // shown as a label in config UI for authentication GP service.
      "authenticationGPServiceHintText": "Hint: Use the set button to select or enter URL to geoprocessing service.", // Shown as a hint text in config UI for authentication GP service.
      "btnSet": "Set", // shown as a button text for authentication GP service.
      "emptyAuthGPServiceValueMsg": "Auth GP service cannot be empty", //
      "showAssetAddressLabel": "Show asset address", // shown as a label in config UI for show  asset address.
      "showAssetAddressHintText": "Hint: Display reverse geocoded address of asset in details view.", // Shown as a hint text in config UI for show  asset address.
      "loginScreenMessageLabel": "Login screen message", // shown as a label in config UI for login screen message.
      "loginScreenMessageHintText": "Hint: Message to be displayed in login screen below Log in/ Sign up button.", // Shown as a hint text in config UI for login screen message.
      "additionalFieldDisplayLabel":  "Additional signup fields", // shown as a label in config UI for additional signup fields.
      "additionalFieldDisplayHintText": "Hint: Fields to be displayed in Sign up form in addition to Email. Please enter fields from user table (case-sensitive).", // Shown as a hint text in config UI for additional signup fields.
      "highlightcolorLabel": "Asset highlight color", // shown as a label in config UI for asset highlight color.
      "highlightcolorHintText": "Hint: Color of selection symbol displayed around the asset icon on map.", // Shown as a hint text in config UI for asset highlight color.
      "additionalLoginParametersLabel": "Additional login parameters", // shown as a label in config UI for additional login parameters.
      "additionalLoginParametersHintText": "Hint: Additional parameter hint text", // Shown as a hint text in config UI for additional login parameters.
      "assetSymbolLabel": "Select symbol", // shown as a label in config UI for my asset symbol.
      "assetSymbolLegend": "My asset symbol", // shown as a label in config UI for my asset symbol.
      "assetSymbolHintText": "Hint: Select a symbol to display user's assets.", // Shown as a hint text in con"fig UI for my asset symbol.
      "heightLabel": "Height(pixels)", // Shown as label in config UI
      "widthLabel": "Width(pixels)", // Shown as label in config UI
      "toleranceSettingLabel": "Tolerance setting", // shown as a label in config UI for tolerance setting.
      "toleranceSettingHintText": "Hint: Select tolerance distance and unit. New assets are created when no asset is found within tolerance.", // Shown as a hint text in config UI for tolerance setting.
      "emptyDistanceValueMsg": "Tolerance cannot be Empty", // Shown as error message when distance is empty.
      "invalidInput": "Invalid value for tolerance", // Shown as error when distance have invalid input
      "noGUIDFieldMsg" :"Selected layer does not contain GUID field", // Shown as error message when there is no GUID field available in layer.
      "beforeActionLabel": "Before action image", // shown as a label in config UI for before action label.
      "beforeActionHint": "Hint: Image that will be displayed before performing an action", // Shown as a hint text in config UI for before action.
      "afterActionLabel": "After action image", // shown as a label in config UI for before action label.
      "afterActionHint": "Hint: Image that will be displayed after performing an action", // Shown as a hint text in config UI for before action.
      "primaryStatusLabel": "Primary Status", // Shown as a label in config UI for primary status.
      "primaryStatusHintText": "Hint: Displayed in list view of user’s assets", //Shown as a hint text in config UI for primary status.
      "inValidImageHeighWidthMsg" : "Please enter image dimensions between 20*20 to 50*50", //Shown as a message when invalid image directions are entered.
      "invalidOrEmptyMessagesMsg": "Please make sure all the notification strings has values", //Shown as message when strings are empty or invalid
      "addFieldLabelText":"Add Field", //Shown as label for add field link
      "selectDefaultOptionText": "Select", // Shown as default option in dropdown
      "previewText" : "Preview", //Shown as text in symbol chooser for preview
      "symbolChooserTitleText": "Symbol Chooser", //Shown as title in symbol chooser popup
      "simpleTable": {
      "fieldNameLabel": "FieldName",
      "hintTextLabel": "HintText",
      "actionLabel": "Action"
    },
    "tableField": {
      "emptyFieldNameMsg": "Field name can not be empty.", // Shown as error when field name is empty.
      "duplicateFieldMsg": "Field name already exist." // Shown as error when field name is already exist.
    },

    "gpService": {
      "invalidInputParameters": "Invalid input parameters", // Shown as error message when invalid input parameters.
      "inValidGPService": "Invalid GP service" // Shown as error message for invalid GP service.
    },

    "actions" : {
      "legendLabel" : "Status : ${action}",
      "actionLabel" : "Label",
      "actionLabelHint": "Hint: Button label displayed in asset detail view",
      "urlParameterLabel" : "URL Parameter",
      "urlParameterLabelHint": "Hint: URL parameter to process this set of actions",
      "actionTextLabel": "Actions",
      "actionTextLink" : "Add Action",
      "assignStatusLabel" :"Assign status settings",
      "unassignStatusLabel" :"Unassign status settings",
      "statusLabel" : "Additional status settings",
      "addStatusLabel" : "Add Status",
      "emptyActionNameMsg": "Status label cannot be empty",
      "emptyURLParamMsg": "Status : ${actionName} URL parameter name cannot be empty",
      "duplicateActionNameMsg": "Duplicate status : ${actionName}",
      "duplicateURLParamMsg": "Duplicate url parameter ${urlParameter} in Status : ${actionName}",
      "duplicateActionMsg": "Duplicate action : ${fieldName} in status : ${actionName}",
      "emptySetValueMsg": "Please enter value for field : ${fieldName} in status : ${actionName}",
      "noAdditionalActionMsg": "Please add an action in status : ${actionName}",
      "invalidURLParameter": "Cannot use '${urlParameter}' as url parameter in status : ${actionName}action, as it is a reserved keyword",
      "invalidSetValueMsg": "Please enter numeric value for field : ${fieldName} in status : ${actionName}",
      "invalidCharacterInURLParameter" : "Invalid character in url parameter '${urlParameter}' in status : ${actionName}",
      "moveUpTitle": "Move up",
      "moveDownTitle": "Move down",
      "actionPanelAssignLabel" :"Assign",
      "actionPanelAssignHint" : "Message displayed when asset is successfully assigned. Use '${assetTitle}' to display the title of asset in message (optional).",
      "actionPanelUnAssignLabel" : "Unassign",
      "actionPanelUnAssignHint": "Message displayed when asset is successfully unassigned",
      "actionSuccessfulLabel": "Action",
      "actionSuccessfulHint": "Message displayed when action is successfully completed. Use '${actionName}' to display the name of action in message (optional).",
      "assetNotFoundLabel": "Asset not found",
      "assetNotFoundHint": "Message displayed when asset is not found",
      "assetAlreadyAssignedLabel": "Asset already assigned",
      "assetAlreadyAssignedHint": "Message displayed when asset is already assigned. Use '${assetTitle}' to display the title of asset in message(optional).",
      "unableToPerformActionLabel": "Unable to perform action",
      "unableToPerformActionHint": "Message displayed when action is not successful. Use '${actionName}' to display the name of action in message (optional).",
      "createNewAssetLabel": "Asset creation",
      "createNewAssetHint": "Message displayed when creating new asset. Use '${layerName}' to display the name of layer in message(optional).",
      "createNewAssetFailedLabel": "Create asset failed",
      "createNewAssetFailedHint": "Message displayed when asset creation fails",
      "tokenExpiredLabel": "User token expired",
      "tokenExpiredHint": "Message displayed when user token is expired and regenerated",
      "authenticationSuccessLabel": "Signup/login success",
      "authenticationSuccessHint" :"Message displayed after successful signup/login",
      "homeScreenMsgLabel": "Home screen (when logged in)",
      "homeScreenMsgHint" : "Message displayed in widget's home screen after user logs in",
      "beforeLoginTooltipLabel" : "Cursor tooltip before login",
      "beforeLoginTooltipHint" : "Map cursor tooltip message when user is not logged in",
      "afterLoginTooltipLabel" : "Cursor tooltip after login",
      "afterLoginTooltipHint" : "Map cursor tooltip message when user is logged in",
      "nicknameLabel" : "Nickname hint",
      "nicknameHint" : "Message displayed in nickname input box",
      "deleteActionTooltip": "Delete action",
      "duplicateURL":"Duplicate URL Parameter",
      "duplicateAction": "Duplicate Action Label",
      "reservedURLParam": "Reserved url parameter",
      "illegalCharacter": "Illegal Character",
      "invalidNumericValue" : "Please enter a numeric value"
    }

  }),
  "ar": 1,
  "cs": 1,
  "da": 1,
  "de": 1,
  "el": 1,
  "es": 1,
  "et": 1,
  "fi": 1,
  "fr": 1,
  "he": 1,
  "it": 1,
  "ja": 1,
  "ko": 1,
  "lt": 1,
  "lv": 1,
  "nb": 1,
  "nl": 1,
  "pl": 1,
  "pt-br": 1,
  "pt-pt": 1,
  "ro": 1,
  "ru": 1,
  "sv": 1,
  "th": 1,
  "tr": 1,
  "vi": 1,
  "zh-cn": 1,
  "zh-hk": 1,
  "zh-tw": 1
});
