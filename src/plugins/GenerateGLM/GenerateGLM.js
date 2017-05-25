/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator 0.14.0 from webgme on Mon Apr 04 2016 12:03:32 GMT-0700 (PDT).
 */

define([
    'plugin/PluginConfig',
    'text!./metadata.json',
    'plugin/PluginBase',
    'gridlabd/meta',
    'gridlabd/modelLoader',
    'gridlabd/renderer',
    'q'
], function (
    PluginConfig,
    pluginMetadata,
    PluginBase,
    MetaTypes,
    loader,
    renderer,
    Q) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of GenerateGLM.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin GenerateGLM.
     * @constructor
     */
    var GenerateGLM = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
        this.metaTypes = MetaTypes;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    GenerateGLM.metadata = pluginMetadata;

    // Prototypal inheritance from PluginBase.
    GenerateGLM.prototype = Object.create(PluginBase.prototype);
    GenerateGLM.prototype.constructor = GenerateGLM;

    GenerateGLM.prototype.notify = function(level, msg) {
	var self = this;
	var prefix = self.projectId + '::' + self.projectName + '::' + level + '::';
	if (level=='error')
	    self.logger.error(msg);
	else if (level=='debug')
	    self.logger.debug(msg);
	else if (level=='info')
	    self.logger.info(msg);
	else if (level=='warning')
	    self.logger.warn(msg);
	self.createMessage(self.activeNode, msg, level);
	self.sendNotification(prefix+msg);
    };

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    GenerateGLM.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this,
        modelNode;

	self.result.success = false;
	self.runningOnServer = true;

        if (typeof WebGMEGlobal !== 'undefined') {
	    self.runningOnServer = false;
        }

	self.updateMETA(self.metaTypes);

	// What did the user select for our configuration?
	var currentConfig = self.getCurrentConfig();
	self.returnZip = currentConfig.returnZip;

        modelNode = self.activeNode;
	self.modelName = self.core.getAttribute(modelNode, 'name');
	self.model = {};
	self.fileData = '';
	self.fileName = self.modelName + '.glm';

	return loader.loadModel(self.core, modelNode, true, true)
	    .then(function(powerModel) {
		self.powerModel = powerModel;
	    })
	    .then(function() {
		return self.renderFile();
	    })
	    .then(function() {
		return self.generateLocalArtifacts();
	    })
	    .then(function() {
		return self.generateBlobArtifacts();
	    })
	    .then(function() {
		self.result.success = true;
		self.createMessage(self.activeNode, 'Generated GLM.');
		callback(null, self.result);
	    })
	    .catch(function(err) {
		self.result.success = false;
		self.createMessage(self.activeNode, err, 'error');
		callback(err, self.result);
	    });
    };

    GenerateGLM.prototype.renderFile = function() {
	var self = this;
	self.fileData = renderer.renderGLM(self.powerModel, self.core, self.META);
	self.notify('info', 'Rendered GLM.');
    };

    GenerateGLM.prototype.generateLocalArtifacts = function() {
	var self = this;
	if (!self.runningOnServer) {
	    self.notify('info', 'Running in client, skipping server-side file-system GLM generation');
	    return;
	}
	var path = require('path');
	var filendir = require('filendir');

	self.notify('info', 'Saving GLM on server FS.');

	var root_dir = path.join(process.cwd(), 
				 'generated', 
				 self.project.projectId, 
				 self.branchName,
				 'models');

	var deferred = Q.defer();
	filendir.writeFile(path.join(root_dir, self.fileName), self.fileData, function(err) {
	    if (err) {
		deferred.reject(err);
	    }
	    else {
		deferred.resolve();
	    }
	});
	return deferred.promise;
    };

    GenerateGLM.prototype.generateBlobArtifacts = function() {
	var self = this;
	if (!self.returnZip) {
	    self.notify('info', 'User did not request the model to be returned.');
	    return;
	}
	
	self.notify('info', 'Returning model to user.');

	return self.blobClient.putFile(self.fileName, self.fileData)
	    .then(function (hash) {
		self.result.addArtifact(hash);
	    });
    };

    return GenerateGLM;
});
