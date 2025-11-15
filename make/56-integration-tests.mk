# Integration and functional test targets for ai-ready
# This file extends the standard test setup with additional test types

#####
# Functional tests (CLI-level tests using execFile)
#####

FUNCTIONAL_TEST_REPORT:=$(QA)/functional-test.txt
FUNCTIONAL_TEST_PASS_MARKER:=$(QA)/.functional-test.passed
FUNCTIONAL_TEST_STAGING:=$(TEST_STAGING)/tests/functional
FUNCTIONAL_TEST_FILES:=$(wildcard tests/functional/*.js)
FUNCTIONAL_TEST_FILES_BUILT:=$(patsubst tests/functional/%, $(FUNCTIONAL_TEST_STAGING)/%, $(FUNCTIONAL_TEST_FILES))

# Transpile functional tests to test-staging
$(FUNCTIONAL_TEST_FILES_BUILT) &: $(FUNCTIONAL_TEST_FILES)
	@echo "Transpiling functional tests..."
	@mkdir -p $(FUNCTIONAL_TEST_STAGING)
	@NODE_ENV=test $(SDLC_BABEL) \
		--config-file=$(SDLC_BABEL_CONFIG) \
		--out-dir=./$(FUNCTIONAL_TEST_STAGING) \
		--source-maps=inline \
		tests/functional

.PHONY: functional-test
functional-test: build $(FUNCTIONAL_TEST_PASS_MARKER) $(FUNCTIONAL_TEST_REPORT)

$(FUNCTIONAL_TEST_PASS_MARKER) $(FUNCTIONAL_TEST_REPORT): dist/ai-ready-exec.js $(FUNCTIONAL_TEST_FILES_BUILT)
	@echo "Running functional tests..."
	@mkdir -p $(QA)
	@echo -n 'Functional test git rev: ' > $(FUNCTIONAL_TEST_REPORT)
	@git rev-parse HEAD >> $(FUNCTIONAL_TEST_REPORT)
	@( set -e; set -o pipefail; \
	  ( cd $(TEST_STAGING) && $(SDLC_JEST) \
	    --config=$(SDLC_JEST_CONFIG) \
	    --testMatch='**/tests/functional/**/*.test.js' \
	    --runInBand 2>&1 ) \
	  | tee -a $(FUNCTIONAL_TEST_REPORT); \
	  touch $(FUNCTIONAL_TEST_PASS_MARKER) )
	@echo "✔ Functional tests passed"

#####
# Integration tests (Docker-based or standalone)
#####

INTEGRATION_TEST_REPORT:=$(QA)/integration-test.txt
INTEGRATION_TEST_PASS_MARKER:=$(QA)/.integration-test.passed
INTEGRATION_TEST_STAGING:=$(TEST_STAGING)/tests/integration
INTEGRATION_TEST_FILES:=$(wildcard tests/integration/*.test.js)
INTEGRATION_TEST_FILES_BUILT:=$(patsubst tests/integration/%, $(INTEGRATION_TEST_STAGING)/%, $(INTEGRATION_TEST_FILES))

# Transpile integration tests to test-staging
$(INTEGRATION_TEST_FILES_BUILT) &: $(INTEGRATION_TEST_FILES)
	@echo "Transpiling integration tests..."
	@mkdir -p $(INTEGRATION_TEST_STAGING)
	@NODE_ENV=test $(SDLC_BABEL) \
		--config-file=$(SDLC_BABEL_CONFIG) \
		--out-dir=./$(INTEGRATION_TEST_STAGING) \
		--source-maps=inline \
		tests/integration/*.test.js

.PHONY: integration-test
integration-test: build $(INTEGRATION_TEST_PASS_MARKER)

$(INTEGRATION_TEST_PASS_MARKER) $(INTEGRATION_TEST_REPORT): dist/ai-ready-exec.js $(INTEGRATION_TEST_FILES_BUILT)
	@echo "Running integration tests..."
	@mkdir -p $(QA)
	@echo -n 'Integration test git rev: ' > $(INTEGRATION_TEST_REPORT)
	@git rev-parse HEAD >> $(INTEGRATION_TEST_REPORT)
	@( set -e; set -o pipefail; \
	  ( cd $(TEST_STAGING) && $(SDLC_JEST) \
	    --config=$(SDLC_JEST_CONFIG) \
	    --testMatch='**/tests/integration/**/*.test.js' \
	    --runInBand \
	    --testTimeout=30000 2>&1 ) \
	  | tee -a $(INTEGRATION_TEST_REPORT); \
	  touch $(INTEGRATION_TEST_PASS_MARKER) )
	@echo "✔ Integration tests passed"

.PHONY: integration-test-docker
integration-test-docker: build
	@echo "Running Docker-based integration tests..."
	@./tests/integration/integration-test.sh

#####
# Combined test targets
#####

.PHONY: test-functional
test-functional: functional-test

.PHONY: test-integration
test-integration: integration-test

.PHONY: test-all
test-all: test functional-test integration-test
	@echo "✔ All tests (unit + functional + integration) passed"

#####
# Update phony targets
#####

PHONY_TARGETS+=functional-test integration-test integration-test-docker test-functional test-integration test-all

#####
# end integration tests
#####
