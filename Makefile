APP_CONTAINER = app

npm-%:
		docker compose exec -it $(APP_CONTAINER) npm $(subst npm-,,$@) $(filter-out $@,$(MAKECMDGOALS))

%:
        @:%                                             
