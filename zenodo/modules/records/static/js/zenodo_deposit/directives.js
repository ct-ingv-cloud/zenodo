// This file is part of Zenodo.
// Copyright (C) 2017 CERN.
//
// Zenodo is free software; you can redistribute it
// and/or modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation; either version 2 of the
// License, or (at your option) any later version.
//
// Zenodo is distributed in the hope that it will be
// useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Zenodo; if not, write to the
// Free Software Foundation, Inc., 59 Temple Place, Suite 330, Boston,
// MA 02111-1307, USA.
//
// In applying this license, CERN does not
// waive the privileges and immunities granted to it by virtue of its status
// as an Intergovernmental Organization or submit itself to any jurisdiction.

function prereserveButton($rootScope, InvenioRecordsAPI) {
  function link($scope, elem, attrs, vm) {
    $scope.prereserveDOI = function() {
      if ($scope.model.prereserve_doi &&
          $scope.model.prereserve_doi.doi) {
        $scope.model.doi = $scope.model.prereserve_doi.doi;
      } else {
        // We need to make a 'POST' call to create a deposit, or a
        // 'GET' in case we already have one, in order to get the
        // pre-reserved DOI.
        var method = angular.isUndefined(vm.invenioRecordsEndpoints.self) ? 'POST': 'GET';
        var url = vm.invenioRecordsEndpoints.self || vm.invenioRecordsEndpoints.initialization;
	console.log(url);
	console.log(method);
	console.log(vm.invenioRecordsArgs.headers);
        $rootScope.$broadcast('invenio.records.loading.start');
        InvenioRecordsAPI.request({
          method: method,
          url: url,
          data: {},
          headers: vm.invenioRecordsArgs.headers || {}
        }).then(function success(resp) {
          if (resp.data.metadata &&
              resp.data.metadata.prereserve_doi &&
              resp.data.metadata.prereserve_doi.doi) {
            $scope.model.prereserve_doi = resp.data.metadata.prereserve_doi;
            $scope.model.doi = '10.1234/tmp.doi.to.change.' + new Date().getTime(); //resp.data.metadata.prereserve_doi.doi;
          }
          $rootScope.$broadcast(
            'invenio.records.endpoints.updated', resp.data.links);
        }, function error(resp) {
          $rootScope.$broadcast('invenio.records.alert', {
            type: 'danger',
            data: resp.data,
          });
        })
        .finally(function() {
          $rootScope.$broadcast('invenio.records.loading.stop');
        });
      }
    };
  }

  return {
    scope: false,
    restrict: 'A',
    require: '^invenioRecords',
    link: link,
  };
}

prereserveButton.$inject = [
  '$rootScope',
  'InvenioRecordsAPI',
];


function retrieveMetadata($rootScope, InvenioRecordsAPI, $http, $q ) {
  	console.log('DBG:Retrieve Metadata Angular JS directive loaded');
  

  var pdz_dep_url = 'https://pdz-dev.ddns.net:5000/api/deposit/depositions/';
  var config = 'Authorization: Bearer ACCESS_TOKEN';


  function simpleParser(data, metadata) {
        var metadataResult = {};
        console.log(data);

          //LOCATIONS
          var result = [];
          var locations = data.attributes['geoLocations'];
          locations.forEach(function(loc) {
                var obj= {};
                if ('geoLocationPlace' in loc)
                        obj['place'] = loc.geoLocationPlace;
                if ('geoLocationPoint' in loc) {
                        if (loc.geoLocationPoint.pointLatitude !== undefined) {
                                obj['lat'] = loc.geoLocationPoint.pointLatitude;
                        }
                        if (loc.geoLocationPoint.pointLongitude !== undefined) {
                                obj['lon'] = loc.geoLocationPoint.pointLongitude;
                        }
                }
                if ('geoLocationBox' in loc) {
                        if (loc.geoLocationBox.eastBoundLongitude !== undefined) {
                                obj['lon'] = loc.geoLocationBox.eastBoundLongitude;
                        }
                        if (loc.geoLocationBox.northBoundLatitude !== undefined) {
                                obj['lat'] = loc.geoLocationBox.northBoundLatitude;
                        }
                }
                result.push(obj);
          });
          metadata['locations'] = result;

          //KEYWORDS
          result = [];
          data.attributes['subjects'].forEach(function(subj) {
                result.push(subj['subject']);
          });
          metadata['keywords'] = result;

          return metadata;
  }



  function link($scope, elem, attrs, vm) {
	console.log('DBG:Retrieve Metadata:Link Function loaded');
	//$scope.model.datacite_metadata = 0
	$scope.retrieveMetadata = function(rec) {
		console.log('DBG:Button pressed');
		console.log(rec);
		//$scope.model.datacite_metadata = 1
	
		var dc_url = "https://api.datacite.org/dois/" + rec.doi;
		var dc_metadata = {};

		$http({
			method : "GET",
			url : dc_url
		}).then(function mySuccess(response) {
			dc_metadata = response.data.data;
			var url = pdz_dep_url + rec.recid;

			// 1 Deposition from Record
			//
			$http.get(url, {}, config).then(function(response) {
				// 2 Unlock Edit Action
				// in response.data retrieve metadata field
				//
				$http.post(url + '/actions/edit', {}, config).then(function(response) {
					// 3 Remapping metadata
					//
					response.data.metadata = simpleParser(dc_metadata, response.data.metadata);
					
					console.log(response.data.metadata);
					$http.put(url, {'metadata': response.data.metadata}, config).then(function(response) {
						// 4 Action Publish
						// 
						$http.post(url + '/actions/publish', {}, config).then(function(response) {
							// Published
							//
							console.log(response);
						}, function (error) { 
							console.log('STEP 4'); 
							console.error(error);
							$http.post(url + '/actions/discard', {}, config).then(function(response) {}, function(error) {}); 
						});							
					}, function(error) { //Call discard action
						console.log('STEP 3'); 
						console.error(error); 
						$http.post(url + '/actions/discard', {}, config).then(function(response) {}, function(error) {});
					});
			
				}, function (error) { console.log('STEP 2'); console.error(error) });
			}, function(error) { console.log('STEP 1'); console.error(error) });
			
			//$scope.model.datacite_metadata = 1
		}, function myError(response) {
			$scope.statusText = response.statusText;
		});
	}
  }
  return {
    scope: false,
    restrict: 'A',
    link: link,
  };
}

retrieveMetadata.$inject = [
	'$rootScope',
	'InvenioRecordsAPI',
	'$http',
	'$q',
	'$interval',
];

function communitiesSelect($http, $q, openAIRE) {
  function link($scope, elem, attrs, vm) {
    // Locals
    function initCommunities() {
      $scope.model.communities = $scope.model.communities || [];
      $scope.model.communities = $scope.model.communities.filter(
        function(comm) { return 'identifier' in comm; });
      var requests = $scope.model.communities.filter(function(comm) {
        return 'identifier' in comm;
      }).map(function(comm) {
        return $http.get('/api/communities/' + comm.identifier);
      });
      // TODO: Add a loading indicator
      $q.all(requests).then(function(fetchedCommunities) {
        $scope.communities = fetchedCommunities.map(function(res) {
          return res.data;
        }).filter(function(comm) { return 'id' in comm; });
      });
    }

    $scope.communities = [];
    $scope.communityResults = [];
    $scope.openAIRECommunities = openAIRE.communities;
    $scope.openAIRECommunitiesMapping = openAIRE.communitiesMapping;

    initCommunities();

    // Methods
    function getOpenAIRECommunities() {
      var modelCommunities = $scope.model.communities || [];
      var openaireComms = [];
      _.each(modelCommunities, function(comm) {
        if (comm.identifier in $scope.openAIRECommunitiesMapping) {
          openaireComms = openaireComms.concat($scope.openAIRECommunitiesMapping[comm.identifier]);
        }
      });
      return _.uniq(openaireComms);
    }

    $scope.refreshCommunityResults = function(data) {
      var data = data || $scope.communityResults;
      $scope.communityResults = _.filter(data, function(comm){
        return _.find($scope.communities, function(c) { return c.id == comm.id}) == undefined;
      });
    };

    $scope.searchCommunities = function(query) {
      $http.get('/api/communities', {params: {q: query, size: 15} })
      .then(function(res){
        $scope.refreshCommunityResults(res.data.hits.hits);
      });
    }

    $scope.communityOnSelect = function(community) {
      $scope.communities.push(community)
      $scope.model.communities.push({identifier: community.id})
      $scope.refreshCommunityResults()
    };

    $scope.removeCommunity = function(commId) {
      $scope.communities = _.filter($scope.communities, function(comm){
        return comm.id !== commId;
      });
      $scope.model.communities = _.filter($scope.model.communities, function(comm){
        return comm.identifier !== commId;
      });
      // Unset the OpenAIRE subtype if it belongs to the unselected community
      var openaireComms = getOpenAIRECommunities();
      var commTypes = _.pick($scope.openAIRECommunities, openaireComms)
      var oaTypes = [];
      _.each(commTypes, function(comm) {
        _.each(comm.types[uploadType] || [], function(type) {
          oaTypes.push({ id: type.id, name: type.name, commName: comm.name })
        })
      })
      if(!($scope.model.openaire_type in oaTypes)) {
        $scope.model.openaire_type = undefined;
      }
      $scope.refreshCommunityResults()
    }
  }
  return {
    scope: false,
    restrict: 'AE',
    require: '^invenioRecords',
    link: link,
  };
}

communitiesSelect.$inject = [
  '$http',
  '$q',
  'openAIRE',
];


function openaireSubtype(openAIRE) {
  function link($scope, elem, attrs, vm) {
    // Locals
    $scope.openAIRECommunities = openAIRE.communities;
    $scope.openAIRECommunitiesMapping = openAIRE.communitiesMapping;
    $scope.vm = vm;

    // Methods
    function getOpenAIRECommunities() {
      var modelCommunities = $scope.model.communities || [];
      var openaireComms = [];
      _.each(modelCommunities, function(comm) {
        if (comm.identifier in $scope.openAIRECommunitiesMapping) {
          openaireComms = openaireComms.concat($scope.openAIRECommunitiesMapping[comm.identifier]);
        }
      });
      return _.uniq(openaireComms);
    }

    $scope.show = function() {
      var uploadType = $scope.model.upload_type;
      var openaireComms = getOpenAIRECommunities();
      var commTypes = _.pick($scope.openAIRECommunities, openaireComms)
      var res = !angular.equals(commTypes, {}) &&
      _.any(commTypes, function(comm) { return uploadType in comm.types; });
      return res;
    }

    $scope.getOptions = function() {
      var uploadType = $scope.model.upload_type;
      var openaireComms = getOpenAIRECommunities();
      var commTypes = _.pick($scope.openAIRECommunities, openaireComms)
      var options = [];
      _.each(commTypes, function(comm) {
        _.each(comm.types[uploadType] || [], function(type) {
          options.push({ id: type.id, name: type.name, commName: comm.name })
        })
      })
      return options;
    }
  }
  return {
    scope: false,
    restrict: 'AE',
    require: '^invenioRecords',
    link: link,
  };
}

openaireSubtype.$inject = [
  'openAIRE',
];


function selectResourceTypes(resourceTypes) {
  function link($scope, elem, attrs, vm) {
    // Locals
    $scope.resourceTypesList = [{'title': 'N/A'}].concat(resourceTypes.resourceTypesList);
    $scope.vm = vm;
  }
  return {
    scope: false,
    restrict: 'AE',
    require: '^invenioRecords',
    link: link,
  };
}

selectResourceTypes.$inject = [
  'resourceTypes',
];

angular.module('invenioRecords.directives')
  .directive('prereserveButton', prereserveButton)
  .directive('communitiesSelect', communitiesSelect)
  .directive('openaireSubtype', openaireSubtype)
  .directive('selectResourceTypes', selectResourceTypes)
  .directive('retrieveMetadata', retrieveMetadata);
